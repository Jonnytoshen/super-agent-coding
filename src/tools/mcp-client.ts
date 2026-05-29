import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import type { SafeAny } from '../types';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface MCPCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

/**
 * MCPClient 是一个用于与 Model Context Protocol (MCP) 服务器通信的客户端类。
 * 它通过启动一个子进程来运行 MCP 服务器，并使用 JSON-RPC 协议进行通信。
 * 主要功能包括连接服务器、列出可用工具、调用工具以及关闭连接。
 */
export class MCPClient {
  private process: ChildProcess | null = null;
  private rl: Interface | null = null;
  private requestId = 0;
  // pending 用于跟踪未完成的请求，键为请求 ID，值为对应的 resolve 和 reject 函数
  private pending = new Map<
    number,
    {
      resolve: (v: SafeAny) => void;
      reject: (e: Error) => void;
    }
  >();
  private serverName: string;

  /**
   * 构造函数，初始化 MCPClient 实例
   * @param command 启动 MCP 服务器的命令
   * @param args 启动 MCP 服务器的命令行参数
   * @param env 可选的环境变量，用于配置 MCP 服务器的运行环境
   */
  constructor(
    private command: string,
    private args: string[],
    private env?: Record<string, string>,
  ) {
    // 例如：'@modelcontextprotocol/server-github' -> 'server-github'
    this.serverName = args[args.length - 1]?.replace(/^@.*\//, '') || 'mcp-server';
  }

  /**
   * 连接到 MCP 服务器，启动子进程并进行初始化
   */
  async connect(): Promise<void> {
    // 启动 MCP 服务器进程
    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.env },
    });

    this.process.on('error', (err) => {
      console.error(`  [MCP] 进程启动失败: ${err.message}`);
    });
    this.process.stderr?.on('data', () => {});

    this.rl = createInterface({ input: this.process.stdout! });
    this.rl.on('line', (line) => {
      // 解析 MCP 服务器的 JSON-RPC 响应
      try {
        const msg = JSON.parse(line);
        const msgId = msg.id as number | undefined;

        if (msgId !== undefined && this.pending.has(msgId)) {
          const p = this.pending.get(msgId)!;
          this.pending.delete(msgId);
          if (msg.error) {
            p.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`));
          } else {
            p.resolve(msg.result);
          }
        }
      } catch {
        /* ignore non-JSON lines */
      }
    });

    // 发送初始化请求
    await this.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'super-agent', version: '0.5.0' },
    });

    // 通知服务器已初始化完成
    this.process.stdin!.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }) + '\n',
    );
  }

  /**
   * 发送 JSON-RPC 请求到 MCP 服务器
   * @param method 请求方法
   * @param params 请求参数
   * @returns 服务器响应结果
   */
  private send(method: string, params?: SafeAny): Promise<SafeAny> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timeout: ${method}`));
      }, 15000);

      this.pending.set(id, {
        resolve: (v: SafeAny) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e: Error) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      this.process!.stdin!.write(msg + '\n');
    });
  }

  /**
   * 获取 MCP 服务器支持的工具列表
   * @returns 工具列表，每个工具包含名称、描述和输入参数结构
   */
  async listTools(): Promise<MCPTool[]> {
    const result = await this.send('tools/list', {});
    return (result.tools || []) as MCPTool[];
  }

  /**
   * 调用指定的 MCP 工具
   * @param name 工具名称
   * @param args 工具参数
   * @returns 工具调用结果的文本内容
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result: MCPCallResult = await this.send('tools/call', { name, arguments: args });
    const texts = (result.content || [])
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text!);
    return texts.join('\n') || '(无返回内容)';
  }

  /**
   * 关闭 MCP 客户端，终止子进程并清理资源
   */
  async close(): Promise<void> {
    if (this.rl) this.rl.close();
    if (this.process) this.process.kill();
    await Promise.resolve(); // 确保异步关闭完成
  }
}
