import { ModelMessage, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { DASHSCOPE_API_KEY } from './config';
import { createInterface } from 'node:readline';

// 创建 OpenAI 实例
const qwen = createOpenAI({
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: DASHSCOPE_API_KEY,
});

// 创建聊天模型实例
const model = qwen.chat('qwen-plus-latest');

// 创建 readline 接口
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages: ModelMessage[] = [];

function askQuestion() {
  rl.question('\nYou: ', async (input) => {
    const trimmed = input.trim();

    // 退出条件。如果用户输入 "exit" 或者直接按回车，则退出程序。
    if (!trimmed || trimmed === 'exit') {
      console.log('Bye!');
      rl.close();
      return;
    }

    // 将用户输入添加到消息列表中
    messages.push({ role: 'user', content: trimmed });

    // 调用模型生成响应
    const result = streamText({
      model,
      system: `你是 Super Agent，一个专注于软件开发的 AI 助手。
你说话简洁直接，喜欢用代码示例来解释问题。
如果用户的问题不够清晰，你会反问而不是瞎猜。`,
      messages,
    });

    process.stdout.write('Assistant: ');

    // 逐步输出模型的响应
    let fullResponse = '';
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      fullResponse += chunk;
    }
    console.log(); // 换行

    // 将模型的完整响应添加到消息列表中
    messages.push({ role: 'assistant', content: fullResponse });

    // 继续提问
    askQuestion();
  });
}

console.log('Super Agent v0.1.0 (type "exit" to quit)\n');
askQuestion();
