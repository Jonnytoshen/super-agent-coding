import type { LanguageModelV3 } from '@ai-sdk/provider';
import { generateText, type ToolResultPart, type ModelMessage } from 'ai';
import { textToolResultOutput, toolResultOutputToText } from './tool-result-output';

/**
 * Estimate the number of tokens for an array of model messages.
 *
 * **Note**: ~4 chars per token for mixed Chinese/English
 *
 * @param messages The array of model messages to estimate tokens for.
 * @returns The estimated number of tokens.
 */
export function estimateTokens(messages: ModelMessage[]): number {
  let chars = 0;
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      chars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if ('text' in part && typeof part.text === 'string') {
          chars += part.text.length;
        } else if ('output' in part) {
          chars += toolResultOutputToText(part.output).length;
        }
      }
    }
  }
  return Math.ceil(chars / 4);
}

// ── Layer 1：Microcompact——清理旧工具结果 ────────────────────────────

const CLEARABLE_TOOLS = new Set([
  'read_file',
  'bash',
  'grep',
  'glob',
  'list_directory',
  'edit_file',
  'write_file',
]);
const KEEP_RECENT_TOOL_RESULTS = 3;

/**
 * ***Layer 1：Microcompact——清理旧工具结果***
 *
 * 这是最轻的一层。不删消息、不改对话结构，只是把旧的工具结果替换成占位符。
 *
 * Microcompact 的做法是：保留消息，替换内容。把 3000 token 的文件内容替换成 `[tool result cleared]`，
 * token 占用从 3000 降到不到 10。
 *
 * - **`CLEARABLE_TOOLS` 白名单**——只清理"查询类"工具的结果。`read_file`、`bash`、`grep` 这些，它们的
 * 返回值是一次性的。如果你定义了一个 `create_issue` 工具，它的返回值（新 Issue 的 ID）可能后续还要用，
 * 不能清理。
 *
 * - **`KEEP_RECENT_TOOL_RESULTS` = 3**——保留最近 3 个工具结果不动。因为最近几轮的结果很可能还在被模型
 * 引用——你刚读的文件、刚跑的命令，模型下一步可能还要用。Claude Code 也是这个思路，只清理"足够老"的结果。
 *
 * @param messages The array of model messages to be microcompacted.
 * @returns An object containing the microcompacted messages and the number of cleared tool results.
 */
export function microcompact(messages: ModelMessage[]): {
  messages: ModelMessage[];
  cleared: number;
} {
  // 找到所有 tool result 消息的位置
  const toolResultIndices: number[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'tool' && Array.isArray(msg.content)) {
      toolResultIndices.push(i);
    }
  }

  // 保留最近 N 个工具结果不动，只清理更早的
  const toClear = toolResultIndices.slice(
    0,
    Math.max(0, toolResultIndices.length - KEEP_RECENT_TOOL_RESULTS),
  );

  let cleared = 0;
  const result = messages.map((msg, idx) => {
    if (!toClear.includes(idx)) return msg;
    if (msg.role !== 'tool' || !Array.isArray(msg.content)) return msg;

    const toolName = (msg.content[0] as ToolResultPart)?.toolName || 'unknown';
    if (!CLEARABLE_TOOLS.has(toolName)) return msg;

    cleared++;
    return {
      ...msg,
      content: msg.content.map((part) => ({
        ...part,
        output: textToolResultOutput('[tool result cleared]'),
      })),
    } satisfies ModelMessage;
  });

  return { messages: result, cleared };
}

// ── Layer 2: LLM Summarization ───────────────────────

const COMPRESS_PROMPT = `你是一个对话压缩系统。你的任务是把 Agent 和用户之间的对话历史压缩成一份结构化摘要，确保后续对话能够无缝继续。

请严格按照以下模板输出，每个字段都要填写。如果某个字段没有相关内容，写"无"：

## 用户意图
（用户在这次对话中想要完成什么）

## 已完成的操作
（Agent 执行了哪些工具调用、产生了什么结果）

## 关键发现
（读取的文件内容要点、搜索结果、命令输出中的关键信息）

## 当前状态
（对话进行到哪一步了、还有什么没做完）

## 需要保留的细节
（文件路径、变量名、配置值、错误信息等不能丢失的具体内容）

注意事项：
- 用对话中使用的语言（中文或英文）输出
- 文件路径、UUID、版本号等标识符必须原样保留，不要翻译或改写
- 不要写笼统的概述，只保留具体的、可操作的信息
- 总长度控制在 800 字以内`;

const CONTEXT_TOKEN_THRESHOLD = 300;
const KEEP_RECENT_MESSAGES = 6;

export interface CompactionResult {
  messages: ModelMessage[];
  summary: string;
  compressedCount: number;
}

/**
 *
 * ***Layer 2：LLM 摘要压缩***
 *
 * 如果 Microcompact 之后上下文还是太大，上第二层——调 LLM 把早期对话压缩成一段结构化摘要。
 *
 * 这一层的核心在于压缩 Prompt 怎么写。一个好的压缩 Prompt 要解决三个问题：
 *
 * - 保什么——不是让模型自由发挥写摘要，而是给一个明确的模板让它填
 * - 不保什么——笼统的概述没用，只保留具体的、可操作的信息
 * - 标识符保护——文件路径、UUID、版本号这些不能被模型"翻译"或改写
 *
 * @param model The language model to use for summarization.
 * @param messages The list of messages to summarize.
 * @param existingSummary An optional existing summary to incorporate.
 * @returns A promise that resolves to a CompactionResult containing the summarized messages.
 */
export async function summarize(
  model: LanguageModelV3,
  messages: ModelMessage[],
  existingSummary?: string,
): Promise<CompactionResult> {
  const tokenEstimate = estimateTokens(messages);
  if (tokenEstimate < CONTEXT_TOKEN_THRESHOLD || messages.length <= KEEP_RECENT_MESSAGES) {
    return { messages, summary: existingSummary || '', compressedCount: 0 };
  }

  // 保留最近 N 条消息，对齐到 user 消息边界
  const splitIdx = Math.max(0, messages.length - KEEP_RECENT_MESSAGES);

  // 对齐到 user 消息边界——切分点一定不能落在 assistant 或 tool 消息上，否则保留的消息列表会以非 user 开头，
  // 很多 LLM API 会报错。注意要从切分点往前找到最近的 user 消息再切。
  let alignedIdx = splitIdx;
  while (alignedIdx > 0 && messages[alignedIdx].role !== 'user') {
    alignedIdx--;
  }
  if (alignedIdx === 0) {
    return { messages, summary: existingSummary || '', compressedCount: 0 };
  }

  const toCompress = messages.slice(0, alignedIdx);
  const toKeep = messages.slice(alignedIdx);

  const conversationText = toCompress
    .map((msg) => {
      const content =
        typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content
                .map((part) =>
                  'text' in part
                    ? part.text
                    : 'output' in part
                      ? toolResultOutputToText(part.output)
                      : '',
                )
                .join('')
            : '';
      return content ? `**${msg.role}**: ${content}` : '';
    })
    .filter(Boolean)
    .join('\n\n');

  if (!conversationText.trim()) {
    return { messages, summary: existingSummary || '', compressedCount: 0 };
  }

  // 已有摘要合并——如果之前已经压缩过一次，新的压缩会把旧摘要和新对话一起传给 LLM。这样摘要是累积的，
  // 不会因为多次压缩而丢失最早期的信息。Claude Code 的 `Auto-compact` 也用了同样的策略。
  const userPrompt = existingSummary
    ? `## 已有摘要（上一次压缩的结果）\n\n${existingSummary}\n\n## 需要压缩的新对话\n\n${conversationText}`
    : conversationText;

  try {
    const { text: summary } = await generateText({
      model,
      system: COMPRESS_PROMPT,
      prompt: userPrompt,
    });

    // 摘要作为 user 消息注入——压缩后的摘要放在消息列表最前面，角色是 `user`。模型看到这条消息就知道"
    // 之前有过对话，这是摘要"，可以基于摘要继续工作。
    const summaryMessage: ModelMessage = {
      role: 'user',
      content: `[以下是之前对话的压缩摘要]\n\n${summary}\n\n[摘要结束，以下是最近的对话]`,
    };

    const newMessages: ModelMessage[] = [summaryMessage, ...toKeep];

    return {
      messages: newMessages,
      summary,
      compressedCount: toCompress.length,
    };
  } catch (err) {
    console.error('[Compaction] LLM 摘要失败:', err);
    return { messages, summary: existingSummary || '', compressedCount: 0 };
  }
}
