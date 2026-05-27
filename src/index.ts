import type { ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { DASHSCOPE_API_KEY } from './config';
import { createInterface } from 'node:readline';
import { ToolRegistry, tools } from './tools';
import { agentLoop } from './agent-loop';
import { VERSION } from './version';
import { createMockModel } from './mock-model';

// 创建 OpenAI 实例
const qwen = createOpenAI({
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: DASHSCOPE_API_KEY,
});

// 创建聊天模型实例
const model = DASHSCOPE_API_KEY ? qwen.chat('qwen-plus-latest') : createMockModel();

// 注册工具
const registry = new ToolRegistry();
registry.register(...tools);

console.log(`已注册 ${registry.getAll().length} 个工具：`);
for (const tool of registry.getAll()) {
  const flags = [
    tool.isConcurrencySafe ? '可并发' : '串行',
    tool.isReadOnly ? '只读' : '读写',
  ].join(', ');
  console.log(`  - ${tool.name}（${flags}）`);
}

// 创建 readline 接口
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 消息列表，存储用户和模型的对话历史
const messages: ModelMessage[] = [];

const SYSTEM = `你是 Super Agent，一个能搜索互联网、读写代码的 AI 助手。

你有 web_search 和 web_fetch 两个搜索相关的工具：
- web_search：搜索互联网，返回相关网页的标题、链接和内容摘要
- web_fetch：抓取指定 URL 的完整内容，转为 Markdown

当用户问的问题需要最新信息时，先用 web_search 搜索，拿到结果后总结回答。
如果搜索结果的摘要不够详细，用 web_fetch 抓取具体链接的全文。

回答简洁直接，引用信息时标注来源链接。`;

function ask() {
  rl.question('\nYou: ', (input) => {
    void (async () => {
      const trimmed = input.trim();

      // 退出条件。如果用户输入 "exit" 或者直接按回车，则退出程序。
      if (!trimmed || trimmed === 'exit') {
        console.log('Bye!');
        rl.close();
        return;
      }

      // 将用户输入添加到消息列表中
      messages.push({ role: 'user', content: trimmed });

      // 进入 Agent 循环
      await agentLoop(model, registry, messages, SYSTEM);

      // 继续提问
      ask();
    })();
  });
}

console.log(`\nSuper Agent v${VERSION} — Search Tool（"exit" 退出）`);
console.log('试试：');
console.log('  1. 搜索一下 Vercel AI SDK 最新版本');
console.log('  2. 2026 年最流行的 Agent 框架是什么?');
console.log('  3. 帮我查一下 TypeScript 5.8 有什么新特性?\n');

ask();
