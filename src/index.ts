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

async function main() {
  await connectMCP();

  printTools();

  const messages: ModelMessage[] = [];
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const deferredSummary = registry.getDeferredToolSummary();
  const SYSTEM = `你是 Super Agent，一个有工具调用能力的 AI 助手。
你有内置工具和 MCP 工具可用。
如果你需要的工具不在当前列表中，使用 tool_search 工具搜索可用工具。
回答要简洁直接。${deferredSummary}`;

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
      messages.push({ role: 'user', content: trimmed });

      // 进入 Agent 循环
      await agentLoop(model, registry, messages, SYSTEM);

      // 继续提问
      ask();
    });
  }

  console.log(`\nSuper Agent v${VERSION} — Dynamic Tools (type "exit" to quit)`);
  console.log('试试："查看 vercel/ai 的 issues"（会触发 tool_search）\n');
  ask();
}

main().catch((err) => {
  const errMsg = err instanceof Error ? err.message : String(err);
  console.error(`启动失败: ${errMsg}`);
});
