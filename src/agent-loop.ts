import { streamText } from 'ai';
import type { ModelMessage, ToolSet } from 'ai';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { detect, recordCall, recordResult, resetHistory } from './loop-detection';
import { calculateDelay, isRetryable, sleep } from './retry';

const MAX_STEPS = 15;
const MAX_RETRIES = 3;

export interface BudgetState {
  used: number;
  limit: number;
}

/**
 * ** Agent 循环的核心逻辑**
 *
 * 1. 调用模型接口，传入当前消息列表和工具信息，开启流式响应。
 * 2. 实时处理模型的输出：文本增量、工具调用、工具结果等。
 * 3. 每当模型调用工具时，进行循环检测，判断是否陷入死循环。
 * 4. 每一步结束后，把新的消息合并到消息列表里，让模型在下一轮能看到上下文。
 * 5. 持续追踪 Token 使用情况，超过预算就停止  。
 *    **最小可用版本**——把每步的 token 用量累加起来，超了就停。更精细的预算管理（输入/输出分开计费、cache 命中折扣）后续再补齐。
 * 6. 如果模型没有调用工具了，说明它已经没有什么好做的了，可以结束循环了。
 * 7. 整个过程有一个最大步数限制，防止无限循环。
 *
 * 注意：这里的重试机制是针对整个步骤的，也就是从调用模型到拿到完整响应这一段。如果在这期间发生了网
 * 络错误或者模型错误，才会触发重试。重试时会重新调用模型接口，之前的上下文和工具调用历史都会保留，
 * 让模型有机会调整策略避免再次出错。
 *
 * **Agent Loop 三层防护，逐层接入**
 *
 * 1. 循环检测——模型反复做同样的事且没有进展，检测到并打断它
 * 2. API 容错——API 限流、超时、网络断开，自动重试而不是直接崩
 * 3. Token 预算——累计追踪 token 消耗，超预算自动停止
 */
export async function agentLoop(
  model: LanguageModelV3,
  tools: ToolSet,
  messages: ModelMessage[],
  system: string,
  budget: BudgetState,
) {
  let step = 0;

  resetHistory(); // 每次新的 Agent 循环开始时，重置工具调用历史记录

  while (step < MAX_STEPS) {
    step++;

    console.log(`\n=== Step ${step} ===`);

    let hasToolCall = false;
    let fullText = '';
    let shouldBreak = false;
    let lastToolCall: { name: string; input: unknown } | null = null;
    let stepResponse: Awaited<ReturnType<typeof streamText>['response']>;
    let stepUsage: Awaited<ReturnType<typeof streamText>['usage']>;

    const handleTextDelta = (text: string) => {
      process.stdout.write(text);
      fullText += text;
    };

    const handleToolCall = (toolName: string, input: unknown) => {
      hasToolCall = true;
      lastToolCall = { name: toolName, input };
      console.log(`  [调用: ${toolName}(${JSON.stringify(input)})]`);

      // 循环检测
      const detection = detect(toolName, input);
      if (detection.stuck) {
        console.log(`  ${detection.message}`);
        if (detection.level === 'critical') {
          shouldBreak = true;
        } else {
          messages.push({
            role: 'user' as const,
            content: `[系统提醒] ${detection.message}。请换一个思路解决问题，不要重复同样的操作。`,
          });
        }
      }
      recordCall(toolName, input);
    };

    const handleToolResult = (result: unknown) => {
      console.log(`  [工具返回: ${JSON.stringify(result)}]`);
      if (lastToolCall) {
        recordResult(lastToolCall.name, lastToolCall.input, result);
      }
    };

    // 步骤级重试：包裹整个 stream 消费过程
    for (let attempt = 1; ; attempt++) {
      try {
        const result = streamText({
          model,
          system,
          tools,
          messages,
          maxRetries: 0, // 第二层防护启用，先禁用模型重试，让我们专注测试第一层的循环检测
          providerOptions: {
            openai: {
              parallelToolCalls: true, // 允许模型同时调用多个工具，测试循环检测在这种情况下的表现
            },
          },
          onError: () => {},
        });

        /**
         * `fullStream` 包含完整的事件流，每个事件都有 `type` 字段:
         *
         * - text-delta：文本片段（跟 textStream 一样）
         * - tool-call：模型决定调用某个工具，包含工具名和参数
         * - tool-result：工具执行完毕，包含返回值
         * - step-start / step-finish：每一步的开始和结束
         * - finish：所有步骤都完成了
         *
         * 在 `for await` 里通过 `switch(part.type)` 来分别处理每种事件。
         */
        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'text-delta':
              handleTextDelta(part.text);
              break;
            case 'tool-call':
              handleToolCall(part.toolName, part.input);
              break;
            case 'tool-result':
              handleToolResult(part.output);
              break;
          }
        }

        stepResponse = await result.response;
        stepUsage = await result.usage;
        break; // 成功拿到结果，跳出重试循环
      } catch (error) {
        if (attempt > MAX_RETRIES || !isRetryable(error)) throw error;

        const delay = calculateDelay(attempt); // 计算重试延迟

        console.log(`  [重试] 第 ${attempt}/${MAX_RETRIES} 次失败，${delay}ms 后重试...`);

        await sleep(delay); // 等待一段时间后重试

        hasToolCall = false;
        fullText = '';
        shouldBreak = false;
        lastToolCall = null;
      }
    }

    if (shouldBreak) {
      console.log('\n[循环检测触发，Agent 已停止]');
      break;
    }

    // 把这一轮的对话结果合并到消息列表里，让模型在下一轮能看到上下文
    messages.push(...stepResponse.messages);

    // Token 预算追踪：budget 由调用方持有，跨轮持续累计
    const inp = stepUsage.inputTokens ?? 0;
    const out = stepUsage.outputTokens ?? 0;
    budget.used += inp + out;
    const pct = Math.round((budget.used / budget.limit) * 100);

    console.log(`  [Token] ${budget.used}/${budget.limit} (${pct}%)`);

    if (budget.used > budget.limit) {
      console.log('\n[Token 预算耗尽，强制停止]');
      break;
    }

    // 退出条件：如果这一轮模型没有调用工具，说明它已经没有什么好做的了，可以结束循环了
    if (!hasToolCall) {
      if (fullText) console.log();
      break;
    }

    // 还有工具调用 → 继续循环，让模型看到工具结果后继续思考
    console.log('  → 模型还在工作，继续下一步...');
  }

  if (step >= MAX_STEPS) {
    console.log('\n[达到最大步数限制，强制停止]');
  }
}
