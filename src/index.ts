import type { ModelMessage, ToolSet } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { DASHSCOPE_API_KEY } from './config';
import { createInterface } from 'node:readline';
import { CalculatorTool, WeatherTool } from './tools';
import { agentLoop, type BudgetState } from './agent-loop';
import { VERSION } from './version';
import { createMockModel } from './mock-model';

// 创建 OpenAI 实例
const qwen = createOpenAI({
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: DASHSCOPE_API_KEY,
});

// 创建聊天模型实例
const model = DASHSCOPE_API_KEY ? qwen.chat('qwen-plus-latest') : createMockModel();

// 创建 readline 接口
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 定义工具集
const tools: ToolSet = {
  get_weather: WeatherTool,
  calculator: CalculatorTool,
};

// 消息列表，存储用户和模型的对话历史
const messages: ModelMessage[] = [];
// 预算由调用方持有，跨轮持续累计——agentLoop 只负责消费它
const budget: BudgetState = { used: 0, limit: 15000 };

const SYSTEM = `你是 Super Agent，一个有工具调用能力的 AI 助手。
需要查询信息时，主动使用工具，不要编造数据。
回答要简洁直接。`;

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
      await agentLoop(model, tools, messages, SYSTEM, budget);

      // 继续提问
      ask();
    })();
  });
}

console.log(`Super Agent v${VERSION} - Agent Loop (type "exit" to quit)\n`);
console.log('试试输入："测试死循环"、"测试重试"、"测试预算" 看三层防护效果\n');
ask();
