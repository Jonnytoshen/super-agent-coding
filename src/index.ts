import type { ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { DASHSCOPE_API_KEY } from './config';
import { createInterface } from 'node:readline';
import { allTools, ToolRegistry } from './tools';
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
registry.register(...allTools);

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

const SYSTEM = `你是 Super Agent，一个能读代码、抓网页、生成项目的 AI 助手。
你有这些工具可用：read_file, write_file, list_directory, edit_file, glob, grep, bash, fetch_url, start_preview, get_weather, calculator。

针对常见任务的执行策略：

1. 用户让你"分析项目"或"找代码"时：
   先 list_directory 看结构 → grep 定位关键内容 → 必要时 read_file 看细节 → 最后给出归纳总结。

2. 用户给你 URL 时：
   用 fetch_url 抓取（多 URL 可以并行），再综合总结。

3. 用户让你"做一个网页应用 / 待办应用 / 任意 web demo"时（必须实际调用工具，不要只描述）：

   **重要的项目约定（不要自己重写 bootstrap）**：
   - app/index.html 已经预置在模板里，固定用 import maps 引 React + Babel Standalone 实时编译 TSX
   - app/index.html 固定加载 ./App.tsx 作为入口、固定引用 ./styles.css 作为样式
   - 你**禁止**写入或修改 app/index.html（它已经能正确工作）

   **你需要做的事**：
   - 用 write_file 至少生成这三个文件：
     1. app/styles.css — 应用样式
     2. app/App.tsx — **必须**用 \`import { createRoot } from 'react-dom/client'\` 把组件渲染到 \`document.getElementById('root')\`
     3. app/Button.tsx 或其他组件 .tsx — 可被 App.tsx import
   - .tsx 之间用相对路径 import：\`import { Button } from './Button.tsx'\`（必须带 .tsx 后缀）
   - React 用 \`import React, { useState } from 'react'\`，不要从其他源导入
   - 文件全部写完后**立即**调用 start_preview 启动预览服务器（这一步绝对不能省）
   - 最后用一段简短文本告诉用户：生成了哪些文件 + 预览地址

回答简洁直接，独立的工具调用尽量并行执行。`;

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

console.log(`\nSuper Agent v${VERSION} — Mini Apps（"exit" 退出）`);
console.log('三个推荐 demo：');
console.log('  1. 找出项目里所有 TODO');
console.log('  2. 去 https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling 看下文档总结');
console.log('  3. 做一个待办清单的网页应用\n');

ask();
