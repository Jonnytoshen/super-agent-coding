/**
 * Mock Model v0.3.0 — 支持 Tool Calling + 死循环模拟
 */
import type {
  LanguageModelV3,
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';

let retryTestCount = 0;

const TEXT_RESPONSES: Record<string, string> = {
  default:
    '你好！我是 Super Agent 的模拟模型。当前使用本地模拟回复，工具调用的机制和真实 API 完全一样。\n\n在 .env 里填入 DASHSCOPE_API_KEY 即可切换到真实的 Qwen 模型。',
  greeting: '你好！我是 Super Agent v0.3.0，现在我不只能聊天，还有保险丝保护了 :)',
  name: '你刚才告诉我了呀！不过说实话，我是模拟模型，能“记住”是因为代码把对话历史传给了我。',
};

interface ToolCallIntent {
  toolName: string;
  args: Record<string, unknown>;
}

function extractUserText(prompt: LanguageModelV3Prompt): string {
  const userMsgs = prompt.filter((m) => m.role === 'user');
  const last = userMsgs[userMsgs.length - 1];

  if (!last) return '';

  return last.content
    .map((c) => (c.type === 'text' ? c.text : ''))
    .join('')
    .toLowerCase();
}

function hasToolResults(prompt: LanguageModelV3Prompt): boolean {
  return prompt.some((m) => m.role === 'tool');
}

function detectToolIntent(prompt: LanguageModelV3Prompt): ToolCallIntent | null {
  const text = extractUserText(prompt);

  if (text.includes('测试死循环') || text.includes('test dead loop')) {
    return { toolName: 'get_weather', args: { city: '北京' } };
  }

  if (hasToolResults(prompt)) return null;

  const weatherKeywords = ['天气', 'weather', '温度', '热', '冷', '气温', '下雨', '晴'];
  const hasWeatherIntent = weatherKeywords.some((kw) => text.includes(kw));
  const cities = text.match(/(北京|上海|深圳|广州|杭州|成都)/g);
  if (hasWeatherIntent && cities && cities.length > 0) {
    return { toolName: 'get_weather', args: { city: cities[0] } };
  }

  const calcMatch = text.match(/(\d+)\s*[+\-*/加减乘除]\s*(\d+)/);
  if (calcMatch) {
    const op = text.match(/[+*/]|加|减|乘|除|-/)?.[0] || '+';
    const opMap: Record<string, string> = { 加: '+', 减: '-', 乘: '*', 除: '/' };
    const expression = `${calcMatch[1]} ${opMap[op] || op} ${calcMatch[2]}`;
    return { toolName: 'calculator', args: { expression } };
  }
  if (text.includes('计算') || text.includes('等于')) {
    const nums = text.match(/\d+/g);
    if (nums && nums.length >= 2) {
      return { toolName: 'calculator', args: { expression: `${nums[0]} + ${nums[1]}` } };
    }
  }

  return null;
}

function pickTextResponse(prompt: LanguageModelV3Prompt): string {
  if (hasToolResults(prompt)) {
    const toolMsgs = (prompt || []).filter((m) => m.role === 'tool');
    const lastResult = toolMsgs[toolMsgs.length - 1];
    const content = lastResult.content
      .map((c) => {
        return c.type === 'tool-result' && c.output.type === 'text' ? c.output.value : '';
      })
      .join('');
    if (content.includes('°C') || content.includes('天气')) return `根据查询结果：${content}`;
    if (content.includes('=')) return `计算结果：${content}`;
    return `工具返回了以下信息：${content}`;
  }
  const text = extractUserText(prompt);
  if (text.includes('你好') || text.includes('hello') || text.includes('hi'))
    return TEXT_RESPONSES.greeting;
  if (text.includes('叫什么') || text.includes('名字') || text.includes('记'))
    return TEXT_RESPONSES.name;
  return TEXT_RESPONSES.default;
}

function isInBudgetTestMode(prompt: LanguageModelV3Prompt): boolean {
  return prompt.some((m) => {
    if (m.role !== 'user') return false;
    const text = m.content
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('')
      .toLowerCase();
    return text.includes('测试预算') || text.includes('test budget');
  });
}

function makeUsage(prompt: LanguageModelV3Prompt): LanguageModelV3Usage {
  let inputTokens = 300;
  let outputTokens = 200;

  // If the prompt contains "测试预算" or "test budget", we simulate a higher token usage to test budget tracking.
  if (isInBudgetTestMode(prompt)) {
    inputTokens = 3000;
    outputTokens = 1500;
  }

  return {
    inputTokens: {
      total: inputTokens,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: outputTokens, text: undefined, reasoning: undefined },
  };
}

/**
 * 创建一个模拟的 ReadableStream，用于模拟模型的流式输出。
 * @param chunks 要输出的流片段数组
 * @param delayMs 每个片段之间的延迟，单位毫秒
 */
function createDelayedStream(chunks: LanguageModelV3StreamPart[], delayMs = 30): ReadableStream {
  return new ReadableStream({
    start(controller) {
      let i = 0;
      function next() {
        if (i < chunks.length) {
          controller.enqueue(chunks[i++]);
          setTimeout(next, delayMs);
        } else {
          controller.close();
        }
      }
      next();
    },
  });
}

/**
 * 创建一个模拟模型实例，支持工具调用和死循环测试。
 */
export function createMockModel(): LanguageModelV3 {
  return {
    specificationVersion: 'v3',
    provider: 'mock',
    modelId: 'mock-model',
    get supportedUrls() {
      return Promise.resolve({});
    },
    doGenerate: async ({ prompt }) => {
      const text = extractUserText(prompt);

      if (text.includes('测试重试') || text.includes('test retry')) {
        retryTestCount++;
        if (retryTestCount <= 2) {
          throw new Error('429 Too Many Requests - Rate limit exceeded');
        }
        retryTestCount = 0;
        return await Promise.resolve({
          content: [{ type: 'text', text: '重试成功！经过几次 429 错误后，我终于回来了。' }],
          finishReason: { unified: 'stop', raw: undefined },
          usage: makeUsage(prompt),
          warnings: [],
        });
      }

      const intent = detectToolIntent(prompt);
      if (intent) {
        return await Promise.resolve({
          content: [
            {
              type: 'tool-call',
              toolCallId: `call-${Date.now()}`,
              toolName: intent.toolName,
              input: JSON.stringify(intent.args),
            },
          ],
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage: makeUsage(prompt),
          warnings: [],
        });
      }

      return await Promise.resolve({
        content: [{ type: 'text', text: '重试成功！经过几次 429 错误后，我终于回来了。' }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: makeUsage(prompt),
        warnings: [],
      });
    },
    doStream: async ({ prompt }) => {
      const text = extractUserText(prompt);

      if (text.includes('测试重试') || text.includes('test retry')) {
        retryTestCount++;
        if (retryTestCount <= 2) {
          throw new Error('429 Too Many Requests - Rate limit exceeded');
        }
        retryTestCount = 0;
        const reply = '重试成功！经过几次 429 错误后，我终于回来了。';
        const id = 'text-1';
        const chunks: LanguageModelV3StreamPart[] = [
          { type: 'text-start', id },
          ...reply
            .split('')
            .map(
              (char: string) =>
                ({ type: 'text-delta', id, delta: char }) satisfies LanguageModelV3StreamPart,
            ),
          { type: 'text-end', id },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: undefined },
            usage: makeUsage(prompt),
          },
        ];
        return await Promise.resolve({ stream: createDelayedStream(chunks, 30) });
      }

      const intent = detectToolIntent(prompt);
      if (intent) {
        const callId = `call-${Date.now()}`;
        const argsJson = JSON.stringify(intent.args);
        const chunks: LanguageModelV3StreamPart[] = [
          { type: 'tool-input-start', id: callId, toolName: intent.toolName },
          { type: 'tool-input-delta', id: callId, delta: argsJson },
          { type: 'tool-input-end', id: callId },
          { type: 'tool-call', toolCallId: callId, toolName: intent.toolName, input: argsJson },
          {
            type: 'finish',
            finishReason: { unified: 'tool-calls', raw: undefined },
            usage: makeUsage(prompt),
          },
        ];
        return await Promise.resolve({ stream: createDelayedStream(chunks, 20) });
      }

      const replyText = pickTextResponse(prompt);
      const id = 'text-1';
      const chunks: LanguageModelV3StreamPart[] = [
        { type: 'text-start', id },
        ...replyText
          .split('')
          .map(
            (char: string) =>
              ({ type: 'text-delta', id, delta: char }) satisfies LanguageModelV3StreamPart,
          ),
        { type: 'text-end', id },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: undefined },
          usage: makeUsage(prompt),
        },
      ];
      return await Promise.resolve({ stream: createDelayedStream(chunks, 30) });
    },
  };
}
