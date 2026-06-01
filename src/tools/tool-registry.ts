import { jsonSchema } from 'ai';
import type { SafeAny } from '../types';
import { type MCPClient } from './mcp-client';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;

  // 元数据——给 Agent Loop 做决策用
  isConcurrencySafe?: boolean; // 能否并行
  isReadOnly?: boolean; // 是否只读
  maxResultChars?: number; // 结果最大长度

  shouldDefer?: boolean; // 是否延迟加载

  /**
   * 如果 shouldDefer 是 true，可以提供 searchHint 来帮助 ToolSearch 判断是否匹配，避免不必要的加载和执行。
   * 一个 3-10 个词的短语，描述这个工具能做什么。比如浏览器导航工具的 hint 是 "browser navigate open url webpage"，
   * Supabase 查询工具的 hint 是 "supabase database sql query select"。模型不会看到这些 hint，它们只
   * 在 ToolSearch 内部用于关键词匹配。
   */
  searchHint?: string;

  // 执行函数，输入参数已被验证为 parameters 定义的格式
  execute: (input: SafeAny) => Promise<unknown>;
}

const DEFAULT_MAX_RESULT_CHARS = 3000;

/**
 * ToolRegistry 负责管理工具定义，并提供转换为 AI SDK 格式的接口
 */
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  // 三个状态变量构成一把读写锁
  private exclusiveLock = false; // 当前是否有独占锁持有者
  private concurrentCount = 0; // 当前共享锁持有数
  private waitQueue: Array<() => void> = []; // 阻塞等待中的 resolve 函数
  private mcpClients: Array<MCPClient> = []; // 追踪已注册的 MCPClient 实例，方便统一关闭

  register(...tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  // 获取共享锁：只要没人独占就能拿，多个只读工具可以同时持有
  private async acquireConcurrent(): Promise<void> {
    while (this.exclusiveLock) {
      await new Promise<void>((r) => this.waitQueue.push(r));
    }
    this.concurrentCount++;
  }

  private releaseConcurrent(): void {
    this.concurrentCount--;
    if (this.concurrentCount === 0) this.drainQueue();
  }

  // 获取独占锁：必须等所有共享锁释放、且没人持独占
  private async acquireExclusive(): Promise<void> {
    while (this.exclusiveLock || this.concurrentCount > 0) {
      await new Promise<void>((r) => this.waitQueue.push(r));
    }
    this.exclusiveLock = true;
  }

  private releaseExclusive(): void {
    this.exclusiveLock = false;
    this.drainQueue();
  }

  // 锁释放时把等待队列全唤醒，让它们重新去抢锁
  private drainQueue(): void {
    const waiting = this.waitQueue.splice(0);
    for (const resolve of waiting) resolve();
  }

  toAISDKFormat(): Record<string, SafeAny> {
    const result: Record<string, SafeAny> = {};
    for (const [name, tool] of this.tools) {
      const maxChars = tool.maxResultChars;
      const executeFn = tool.execute;
      const isSafe = tool.isConcurrencySafe === true;
      const registry = this;

      result[name] = {
        description: tool.description,
        inputSchema: jsonSchema(tool.parameters),
        execute: async (input: SafeAny) => {
          // 在真正执行前先按 isConcurrencySafe 获取锁
          if (isSafe) {
            await registry.acquireConcurrent();
            console.log(`  [并发] ${name} 获取共享锁`);
          } else {
            await registry.acquireExclusive();
            console.log(`  [串行] ${name} 获取独占锁，等待其他工具完成`);
          }
          try {
            const raw = await executeFn(input);
            const text = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
            return truncateResult(text, maxChars);
          } finally {
            // 不管成功还是抛异常，锁都要释放
            if (isSafe) {
              registry.releaseConcurrent();
            } else {
              registry.releaseExclusive();
            }
          }
        },
      };
    }
    return result;
  }

  /**
   * 注册 MCP 服务器，并将其工具注册到 ToolRegistry 中
   * @param serverName MCP 服务器名称
   * @param client MCPClient 实例
   * @returns 注册的工具名称列表
   */
  async registerMCPServer(serverName: string, client: MCPClient): Promise<string[]> {
    await client.connect();
    this.mcpClients.push(client);

    const tools = await client.listTools();
    const registered: string[] = [];

    for (const tool of tools) {
      const prefixedName = `mcp__${serverName}__${tool.name}`;
      if (this.tools.has(prefixedName)) continue;

      const toolClient = client;
      const originalName = tool.name;

      this.register({
        name: prefixedName,
        // description 加了 [MCP:github] 前缀——这不是给模型看的，是给你调试看的。当 Agent 调了一个
        // 工具但结果不对，日志里一眼就能分辨是内置工具的问题还是 MCP Server 的问题。
        description: `[MCP:${serverName}] ${tool.description}`,
        parameters: tool.inputSchema,
        // TODO:
        // MCP 工具通常是无状态的 API 调用（查 issue、搜仓库），天然可以并发。
        // 如果某个 Server 暴露了写操作（比如 create_issue），严格来说应该标记为 false，后续权限系统
        // 会做更细的控制。
        isConcurrencySafe: true,
        isReadOnly: true,
        maxResultChars: 3000,
        shouldDefer: true,
        searchHint: `${serverName} ${originalName} ${tool.description}`,
        execute: async (input: unknown) => {
          return toolClient.callTool(originalName, input as Record<string, unknown>);
        },
      });

      registered.push(prefixedName);
    }

    return registered;
  }

  /**
   * 关闭所有 MCP 连接，清理资源
   */
  async closeAllMCP(): Promise<void> {
    for (const client of this.mcpClients) {
      await client.close();
    }
    this.mcpClients = [];
  }
}

/**
 * 截断工具结果，保留头部和尾部，省略中间部分
 *
 * 如果结果文本超过 maxChars，则保留前 60% 和后 40%，并在中间插入省略提示
 *
 * @param text 原始文本
 * @param maxChars 最大字符数，默认 3000
 * @returns 截断后的文本
 */
export function truncateResult(text: string, maxChars: number = DEFAULT_MAX_RESULT_CHARS): string {
  if (text.length <= maxChars) return text;

  const headSize = Math.floor(maxChars * 0.6);
  const tailSize = maxChars - headSize;
  const head = text.slice(0, headSize);
  const tail = text.slice(-tailSize);
  const dropped = text.length - headSize - tailSize;

  return `${head}\n\n... [省略 ${dropped} 字符] ...\n\n${tail}`;
}
