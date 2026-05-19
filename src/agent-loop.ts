import { streamText } from 'ai';
import type { LanguageModel, ModelMessage, ToolSet } from 'ai';

const MAX_STEPS = 10;

/**
 * 这是一个简单的 Agent 循环示例，展示了如何让模型在多轮对话中调用工具并根据工具结果继续思考。
 *
 * 每一步循环中，模型会生成一些文本（text-delta），可能还会决定调用某个工具（tool-call）。我们会执行
 * 这个工具，并把结果（tool-result）展示出来。
 * 模型看到工具结果后可能会继续生成更多文本，或者再调用一次工具。只要模型还在调用工具，我们就继续循环。
 * 一旦模型不再调用工具了，我们就认为它已经完成了思考，可以结束循环了。
 *
 * 注意：这个示例里没有设置 `stopWhen` 条件，所以每次模型生成完一轮文本和工具调用后都会停止，让我们
 * 有机会处理这些事件。实际使用时可以根据需要设置更复杂的停止条件。
 */
export async function agentLoop(
  model: LanguageModel,
  tools: ToolSet,
  messages: ModelMessage[],
  system: string,
) {
  let step = 0;

  while (step < MAX_STEPS) {
    step++;

    console.log(`\n=== Step ${step} ===`);

    const result = streamText({
      model,
      system,
      tools,
      messages,
      // 不设 stopWhen，每次只跑一步
    });

    let hasToolCall = false;
    let fullText = '';

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
          process.stdout.write(part.text);
          fullText += part.text;
          break;
        case 'tool-call':
          hasToolCall = true;
          console.log(`  [调用: ${part.toolName}(${JSON.stringify(part.input)})]`);
          break;
        case 'tool-result':
          console.log(`  [结果: ${JSON.stringify(part.output)}]`);
          break;
      }
    }

    // 等所有事件都处理完了，才把这一轮的结果合并到 messages 里
    const stepMessages = await result.response;
    messages.push(...stepMessages.messages);

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
