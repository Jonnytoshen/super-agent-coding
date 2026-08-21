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
import { applyCompaction } from './context/compressor';
import { applyDefense, estimateMessageTokens, TokenTracker } from './context/defense';

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

/** Inject fake history with timestamps to demo TTL pruning. */
function injectFakeHistory(messages: ModelMessage[], timestamps: Map<number, number>) {
  const now = Date.now();
  const fakeHistory: Array<{ msg: ModelMessage; ageMs: number }> = [
    // 12 minutes ago — will be hard pruned
    { ageMs: 12 * 60 * 1000, msg: { role: 'user', content: '帮我看看 package.json' } },
    {
      ageMs: 12 * 60 * 1000,
      msg: {
        role: 'assistant',
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: 'old-1',
            toolName: 'read_file',
            input: { path: 'package.json' },
          },
        ],
      },
    },
    {
      ageMs: 12 * 60 * 1000,
      msg: {
        role: 'tool',
        content: [
          {
            type: 'tool-result' as const,
            toolCallId: 'old-1',
            toolName: 'read_file',
            output: textToolResultOutput(
              '{\n  "name": "super-agent-09",\n  "version": "0.9.0",\n  "type": "module",\n  "scripts": { "start": "tsx src/index.ts" },\n  "dependencies": {\n    "ai": "5.0.98",\n    "@ai-sdk/openai": "2.0.44",\n    "zod": "3.25.76"\n  }\n}',
            ),
          },
        ],
      },
    },
    {
      ageMs: 12 * 60 * 1000,
      msg: {
        role: 'assistant',
        content: [
          {
            type: 'text' as const,
            text: 'package.json：项目名 super-agent-09，依赖 ai 和 @ai-sdk/openai。',
          },
        ],
      },
    },

    // 7 minutes ago — will be soft pruned
    { ageMs: 7 * 60 * 1000, msg: { role: 'user', content: '搜索 src 目录里的 export' } },
    {
      ageMs: 7 * 60 * 1000,
      msg: {
        role: 'assistant',
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: 'mid-1',
            toolName: 'grep',
            input: { pattern: 'export', path: 'src' },
          },
        ],
      },
    },
    {
      ageMs: 7 * 60 * 1000,
      msg: {
        role: 'tool',
        content: [
          {
            type: 'tool-result' as const,
            toolCallId: 'mid-1',
            toolName: 'grep',
            output: textToolResultOutput(
              'src/tools.ts:1: export const weatherTool = ...\nsrc/tools.ts:20: export const calculatorTool = ...\nsrc/tools.ts:40: export const readFileTool = ...\nsrc/tools.ts:60: export const writeFileTool = ...\nsrc/tools.ts:80: export const listDirectoryTool = ...\nsrc/tool-registry.ts:4: export interface ToolDefinition { ... }\nsrc/tool-registry.ts:18: export class ToolRegistry { ... }\nsrc/agent-loop.ts:7: export async function agentLoop(...) { ... }\nsrc/session-store.ts:8: export class SessionStore { ... }\nsrc/prompt-builder.ts:12: export class PromptBuilder { ... }\nsrc/context-defense.ts:5: export class TokenTracker { ... }\nsrc/context-defense.ts:50: export function estimateMessageTokens(...) { ... }\nsrc/context-defense.ts:70: export function truncateToolResults(...) { ... }\nsrc/context-defense.ts:110: export function ttlPrune(...) { ... }',
            ),
          },
        ],
      },
    },
    {
      ageMs: 7 * 60 * 1000,
      msg: {
        role: 'assistant',
        content: [
          {
            type: 'text' as const,
            text: 'src 目录里的主要导出：tools.ts 定义了各种工具，tool-registry.ts 导出 ToolRegistry 类，context-defense.ts 导出了 TokenTracker、truncateToolResults、ttlPrune 等。',
          },
        ],
      },
    },

    // 1 minute ago — will NOT be pruned
    { ageMs: 1 * 60 * 1000, msg: { role: 'user', content: '读一下 sample-data.txt' } },
    {
      ageMs: 1 * 60 * 1000,
      msg: {
        role: 'assistant',
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: 'new-1',
            toolName: 'read_file',
            input: { path: 'sample-data.txt' },
          },
        ],
      },
    },
    {
      ageMs: 1 * 60 * 1000,
      msg: {
        role: 'tool',
        content: [
          {
            type: 'tool-result' as const,
            toolCallId: 'new-1',
            toolName: 'read_file',
            output: textToolResultOutput(
              'Super Agent 工具系统设计文档\n=============================\n\n一、工具注册机制\n每个工具通过 ToolRegistry 统一注册。\n\n二、结果截断策略\nHead/Tail 60/40 分割。\n\n三、并发控制\n读写锁模式。\n\n四、最佳实践\n1. 工具描述要写"什么时候不该用"\n2. 参数描述要具体\n3. 错误信息要对模型友好\n4. 结果格式要结构化',
            ),
          },
        ],
      },
    },
    {
      ageMs: 1 * 60 * 1000,
      msg: {
        role: 'assistant',
        content: [
          {
            type: 'text' as const,
            text: 'sample-data.txt 是工具系统设计文档，包含注册机制、截断策略、并发控制和最佳实践四个部分。',
          },
        ],
      },
    },
  ];

  for (let i = 0; i < fakeHistory.length; i++) {
    const { msg, ageMs } = fakeHistory[i];
    messages.push(msg);
    timestamps.set(messages.length - 1, now - ageMs);
  }
}

async function main() {
  await connectMCP();

  printTools();

  // Session 持久化
  const isContinue = process.argv.includes('--continue');
  const sessionId = 'default';
  const store = new SessionStore(sessionId);
  const timestamps = new Map<number, number>();
  const tracker = new TokenTracker();

  let summary = '';
  let messages: ModelMessage[] = [];

  if (isContinue && store.exists()) {
    messages = store.load();
    console.log(`\n[Session] 恢复会话，${messages.length} 条历史消息`);
  } else if (process.argv.includes('--inject-fake-history')) {
    // Inject fake history with varied ages
    injectFakeHistory(messages, timestamps);
    tracker.addMessages(messages);
    console.log(`\n[Session] 新会话（已注入 ${messages.length} 条模拟历史，时间跨度 12 分钟）`);
  } else {
    console.log(`\n[Session] 新会话`);
  }

  // Apply defense to messages (truncate tool results, prune old messages, estimate tokens)
  const defense = applyDefense(messages, timestamps);
  tracker.replaceMessages(messages, defense.messages);
  messages = defense.messages;

  // Apply compaction to messages (microcompact, summarize) before bootstrapping the agent loop
  const compacted = await applyCompaction(messages, { model, existingSummary: summary });
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

  async function handleQuickTrigger(cmd: string) {
    const now = Date.now();

    if (cmd === '模拟长对话' || cmd === 'sim') {
      console.log('\n[模拟] 注入 20 条历史消息（含大量工具结果）...');
      const beforeLen = messages.length;
      for (let i = 0; i < 30; i++) {
        const age = (20 - i * 4) * 60 * 1000;
        const userIdx = messages.length;
        messages.push({ role: 'user', content: `第 ${i + 1} 轮：帮我读文件 file-${i}.ts` });
        timestamps.set(userIdx, now - age);
        messages.push({
          role: 'assistant',
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: `sim-${i}`,
              toolName: 'read_file',
              input: { path: `file-${i}.ts` },
            },
          ],
        });
        timestamps.set(userIdx + 1, now - age);
        const bigContent =
          `// file-${i}.ts\n` + 'export function handler() {\n  // ...\n}\n'.repeat(2000);
        messages.push({
          role: 'tool',
          content: [
            {
              type: 'tool-result' as const,
              toolCallId: `sim-${i}`,
              toolName: 'read_file',
              output: textToolResultOutput(bigContent),
            },
          ],
        });
        timestamps.set(userIdx + 2, now - age);
        messages.push({
          role: 'assistant',
          content: [{ type: 'text' as const, text: `文件 file-${i}.ts 的内容已读取。` }],
        });
        timestamps.set(userIdx + 3, now - age);
      }
      tracker.addMessages(messages.slice(beforeLen));
      const tokens = estimateMessageTokens(messages);
      console.log(`[模拟完成] ${messages.length} 条消息, ~${tokens} tokens\n`);
      return true;
    }

    if (cmd === '执行防线' || cmd === 'defend') {
      const defensed = applyDefense(messages, timestamps);
      tracker.replaceMessages(messages, defensed.messages);
      messages = defensed.messages;
      return true;
    }

    if (cmd === '压缩上下文' || cmd === 'compact') {
      const compacted = await applyCompaction(messages, { model, existingSummary: summary });
      tracker.replaceMessages(messages, compacted.messages);
      messages = compacted.messages;
      summary = compacted.summary;
      return true;
    }

    if (cmd === '查看状态' || cmd === 'status') {
      const status = tracker.status;
      const toolMsgs = messages.filter((m) => m.role === 'tool').length;
      console.log(
        `\n[状态] ${messages.length} 条消息 (${toolMsgs} 条工具结果), ~${status.tokens} tokens (${status.percent}%)\n`,
      );
      return true;
    }

    return false;
  }

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

      const quickTriggerHandled = await handleQuickTrigger(trimmed);

      if (quickTriggerHandled) {
        ask();
        return;
      }

      // 将用户输入添加到消息列表中
      const userMsg: ModelMessage = { role: 'user', content: trimmed };
      messages.push(userMsg);
      tracker.addMessage(userMsg);
      timestamps.set(messages.length - 1, Date.now());
      store.append(userMsg);

      // Apply defense to messages (truncate tool results, prune old messages, estimate tokens) before
      // every model turn
      const turnDefense = applyDefense(messages, timestamps);
      tracker.replaceMessages(messages, turnDefense.messages);
      messages = turnDefense.messages;

      const beforeLen = messages.length;

      // 进入 Agent 循环
      await agentLoop(model, registry, messages, SYSTEM);

      // 持久化本轮新增的消息（agent loop 会往 messages 里 push assistant/tool 消息）
      const newMessages = messages.slice(beforeLen);
      const now = Date.now();
      for (let i = 0; i < messages.length; i++) {
        timestamps.set(i, now);
      }
      store.appendAll(newMessages);

      const status = tracker.status;
      console.log(
        `\n[Token Tracker] 当前 token 估算: ${status.tokens} (~${status.percent}% of context window)`,
      );

      // Check if compaction needed after each turn
      const compacted = await applyCompaction(messages, { model, existingSummary: summary });
      tracker.replaceMessages(messages, compacted.messages);
      messages = compacted.messages;
      summary = compacted.summary;

      // 继续提问
      ask();
    });
  }

  console.log(`\nSuper Agent v${VERSION} — Context Defense (type "exit" to quit)`);
  console.log('快捷命令：');
  console.log('  模拟长对话 / sim    — 注入 20 条模拟历史（含大工具结果）');
  console.log('  执行防线 / defend   — 执行三层防线，查看截断和修剪效果');
  console.log('  压缩上下文 / compact — 执行上下文压缩，生成摘要');
  console.log('  查看状态 / status   — 查看当前消息数和 token 估算\n');

  ask();
}

main().catch((err) => {
  const errMsg = err instanceof Error ? err.message : String(err);
  console.error(`启动失败: ${errMsg}`);
});
