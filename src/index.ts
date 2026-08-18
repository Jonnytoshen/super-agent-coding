import { createInterface } from 'node:readline';
import type { ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import CliTable3 from 'cli-table3';
import ora from 'ora';
import { DASHSCOPE_API_KEY, GITHUB_PERSONAL_ACCESS_TOKEN } from './config';
import { MCPClient, ToolRegistry, tools } from './tools';
import { agentLoop } from './agent-loop';
import { VERSION } from './version';
import { createMockModel } from './mock-model';
import { ToolSearch } from './tools/ToolSearch';
import { SessionStore } from './session/store';
import {
  coreRules,
  deferredTools,
  PromptBuilder,
  type PromptContext,
  sessionContext,
  toolGuide,
} from './context/prompt-builder';
import { textToolResultOutput } from './context/tool-result-output';
import { estimateTokens, microcompact, summarize } from './context/compressor';

// 创建 OpenAI 实例
const qwen = createOpenAI({
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: DASHSCOPE_API_KEY,
});

// 创建聊天模型实例
const model = DASHSCOPE_API_KEY ? qwen.chat('qwen-plus-latest') : createMockModel();

// 注册工具
const registry = new ToolRegistry();
registry.register(...tools, ToolSearch(registry)); // ToolSearch 需要访问 registry，所以放在最后注册

async function connectMCP() {
  let canSpawn = true;
  try {
    const { execSync } = await import('node:child_process');
    execSync('echo test', { stdio: 'ignore' });
  } catch {
    canSpawn = false;
  }

  if (GITHUB_PERSONAL_ACCESS_TOKEN && canSpawn) {
    const spinner = ora('正在连接 GitHub MCP Server...').start();
    console.log('\n连接 GitHub MCP Server...');
    try {
      const client = new MCPClient('npx', ['-y', '@modelcontextprotocol/server-github'], {
        GITHUB_PERSONAL_ACCESS_TOKEN,
      });
      const tools = await registry.registerMCPServer('github', client);
      spinner.succeed(`成功连接 GitHub MCP Server，注册了 ${tools.length} 个工具`);
      return;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      spinner.fail(`连接 GitHub MCP Server 失败: ${errMsg}`);
    } finally {
      spinner.stop();
    }
  }

  if (!GITHUB_PERSONAL_ACCESS_TOKEN) {
    console.log('\n未配置 GITHUB_PERSONAL_ACCESS_TOKEN，使用 Mock MCP');
  }
}

function printTools(): void {
  const table = new CliTable3({
    head: ['工具名称', '类型', '并发', '只读', '延迟加载'],
    style: {
      border: ['hex(#FFD700)'],
      head: ['hex(#FFA500)', 'italic'],
    },
  });

  for (const tool of registry.getAll()) {
    const isMCP = tool.name.startsWith('mcp__');
    table.push([
      tool.name,
      isMCP ? 'MCP' : '内置',
      tool.isConcurrencySafe ? '可并发' : '串行',
      tool.isReadOnly ? '只读' : '读写',
      tool.shouldDefer ? '✅' : '❌',
    ]);
  }

  const allCount = registry.getAll().length;
  const activeTools = registry.getActiveTools();
  const estimate = registry.countTokenEstimate();

  console.log(`\nAgent Tools：`);
  console.log(table.toString());
  console.log(`  全部工具: ${allCount} 个`);
  console.log(`  活跃工具: ${activeTools.length} 个（非延迟）`);
  console.log(`  延迟工具: ${allCount - activeTools.length} 个`);
  console.log(`  Token 估算: ~${estimate.active} (活跃) + ~${estimate.deferred} (延迟)`);
}

/** Inject fake history messages to simulate a long conversation. */
function injectFakeHistory(messages: ModelMessage[]) {
  const fakeHistory: ModelMessage[] = [
    { role: 'user', content: '帮我看看当前目录有什么文件' },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool-call' as const,
          toolCallId: 'fake-1',
          toolName: 'list_directory',
          input: { path: '.' },
        },
      ],
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result' as const,
          toolCallId: 'fake-1',
          toolName: 'list_directory',
          output: textToolResultOutput(
            '[FILE] .env\n[DIR] node_modules\n[FILE] package.json\n[FILE] sample-data.txt\n[DIR] src\n[FILE] tsconfig.json',
          ),
        },
      ],
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text' as const,
          text: '当前目录有以下文件：.env, package.json, sample-data.txt, tsconfig.json，以及 src 和 node_modules 两个目录。',
        },
      ],
    },
    { role: 'user', content: '读一下 package.json' },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool-call' as const,
          toolCallId: 'fake-2',
          toolName: 'read_file',
          input: { path: 'package.json' },
        },
      ],
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result' as const,
          toolCallId: 'fake-2',
          toolName: 'read_file',
          output: textToolResultOutput(
            '{\n  "name": "super-agent-08-compaction",\n  "version": "0.8.0",\n  "type": "module",\n  "scripts": { "start": "tsx src/index.ts" },\n  "dependencies": { "ai": "5.0.98", "@ai-sdk/openai": "2.0.44" }\n}',
          ),
        },
      ],
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text' as const,
          text: 'package.json 的内容：项目名 super-agent-08-compaction，版本 0.8.0，依赖 ai 和 @ai-sdk/openai。',
        },
      ],
    },
    { role: 'user', content: '读一下 sample-data.txt' },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool-call' as const,
          toolCallId: 'fake-3',
          toolName: 'read_file',
          input: { path: 'sample-data.txt' },
        },
      ],
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result' as const,
          toolCallId: 'fake-3',
          toolName: 'read_file',
          output: textToolResultOutput(
            'Super Agent 工具系统设计文档\n=============================\n\n一、工具注册机制\n每个工具通过 ToolRegistry 统一注册，提供名称、描述、参数 Schema 和执行函数。\n\n二、结果截断策略\nHead/Tail 60/40 分割，保留文件头部和尾部的关键信息。\n\n三、并发控制\n读写锁模式：只读工具共享锁，读写工具独占锁。\n\n四、最佳实践\n1. 工具描述要写"什么时候不该用"比"能干什么"更有价值\n2. 参数描述要具体——"必须是绝对路径"能防一大类错误\n3. 错误信息要对模型友好——模型需要理解为什么失败才能换策略\n4. 结果格式要结构化——JSON 比自然语言更容易被模型准确解析',
          ),
        },
      ],
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text' as const,
          text: 'sample-data.txt 是一份工具系统设计文档，包含四个部分：工具注册机制、结果截断策略、并发控制和最佳实践。',
        },
      ],
    },
    { role: 'user', content: '帮我搜索一下 src 目录里有哪些 export' },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool-call' as const,
          toolCallId: 'fake-4',
          toolName: 'grep',
          input: { pattern: 'export', path: 'src' },
        },
      ],
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result' as const,
          toolCallId: 'fake-4',
          toolName: 'grep',
          output: textToolResultOutput(
            'src/tools.ts:1: export const weatherTool\nsrc/tools.ts:20: export const calculatorTool\nsrc/tools.ts:40: export const readFileTool\nsrc/tool-registry.ts:4: export interface ToolDefinition\nsrc/tool-registry.ts:18: export class ToolRegistry\nsrc/agent-loop.ts:7: export async function agentLoop\nsrc/session-store.ts:8: export class SessionStore\nsrc/prompt-builder.ts:12: export class PromptBuilder\nsrc/context-compressor.ts:30: export function microcompact\nsrc/context-compressor.ts:80: export async function summarize',
          ),
        },
      ],
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text' as const,
          text: 'src 目录里的主要导出：tools.ts 导出了各种工具定义，tool-registry.ts 导出了 ToolRegistry 类，agent-loop.ts 导出了 agentLoop 函数，还有 SessionStore、PromptBuilder、microcompact 和 summarize 等。',
        },
      ],
    },
  ];
  messages.push(...fakeHistory);
}

async function compactMessages(
  messages: ModelMessage[],
  summary: string = '',
): Promise<{
  messages: ModelMessage[];
  summary: string;
  compressedCount: number;
  clearedToolResult: number;
}> {
  const currentTokens = estimateTokens(messages);

  if (currentTokens < 4000) {
    return { messages, summary: '', compressedCount: 0, clearedToolResult: 0 };
  }

  console.log(`\n=== Context Compaction ===`);
  console.log(`  [压缩检查] ~${currentTokens} tokens, 触发压缩...`);

  const mc2 = microcompact(messages);
  messages = mc2.messages;
  if (mc2.cleared > 0) {
    console.log(`  [Microcompact] 清理了 ${mc2.cleared} 个工具结果`);
  }

  const comp2 = await summarize(model, messages, summary);
  if (comp2.compressedCount > 0) {
    messages = comp2.messages;
    summary = comp2.summary;
    console.log(
      `  [Summarization] 压缩了 ${comp2.compressedCount} 条消息, ~${estimateTokens(messages)} tokens`,
    );
  }

  console.log(`========================`);

  return {
    messages,
    summary,
    compressedCount: comp2.compressedCount,
    clearedToolResult: mc2.cleared,
  };
}

async function main() {
  await connectMCP();

  printTools();

  // Session 持久化
  const isContinue = process.argv.includes('--continue');
  const sessionId = 'default';
  const store = new SessionStore(sessionId);

  let summary = '';
  let messages: ModelMessage[] = [];
  if (isContinue && store.exists()) {
    messages = store.load();
    console.log(`[Session] 恢复会话，${messages.length} 条历史消息`);
  } else if (process.argv.includes('--inject-fake-history')) {
    // 注入模拟历史，演示压缩效果
    injectFakeHistory(messages);
    console.log(`[Session] 新会话（已注入 ${messages.length} 条模拟历史）`);
  } else {
    console.log(`[Session] 新会话`);
  }

  // 启动时先跑一遍压缩（处理恢复的历史消息）
  const compacted = await compactMessages(messages, summary);
  messages = compacted.messages;
  summary = compacted.summary;

  // Prompt Pipe 组装 system prompt
  const builder = new PromptBuilder()
    .pipe('coreRules', coreRules())
    .pipe('toolGuide', toolGuide())
    .pipe('deferredTools', deferredTools())
    .pipe('sessionContext', sessionContext());

  const promptCtx: PromptContext = {
    toolCount: registry.getActiveTools().length,
    deferredToolSummary: registry.getDeferredToolSummary(),
    sessionMessageCount: messages.length,
    sessionId,
  };

  const SYSTEM = builder.build(promptCtx);

  // Debug: 显示 Prompt Pipe 各模块状态
  builder.debug(promptCtx);

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  function ask() {
    rl.question('\nYou: ', async (input) => {
      const trimmed = input.trim();

      // 退出条件。如果用户输入 "exit" 或者直接按回车，则退出程序。
      if (!trimmed || trimmed === 'exit') {
        console.log('Bye!');
        await registry.closeAllMCP();
        rl.close();
        return;
      }

      // 将用户输入添加到消息列表中
      const userMsg: ModelMessage = { role: 'user', content: trimmed };
      messages.push(userMsg);
      store.append(userMsg);

      const beforeLen = messages.length;

      // 进入 Agent 循环
      await agentLoop(model, registry, messages, SYSTEM);

      // 持久化本轮新增的消息（agent loop 会往 messages 里 push assistant/tool 消息）
      const newMessages = messages.slice(beforeLen);
      store.appendAll(newMessages);

      // Check if compaction needed after each turn
      const compacted = await compactMessages(messages, summary);
      messages = compacted.messages;
      summary = compacted.summary;

      // 继续提问
      ask();
    });
  }

  console.log(`\nSuper Agent v${VERSION} — Compaction (type "exit" to quit)`);
  ask();
}

main().catch((err) => {
  const errMsg = err instanceof Error ? err.message : String(err);
  console.error(`启动失败: ${errMsg}`);
});
