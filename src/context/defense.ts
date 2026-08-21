import type { ModelMessage, ToolResultPart } from 'ai';
import { textToolResultOutput, toolResultOutputToText } from './tool-result-output';

export const CONTEXT_WINDOW = 200_000; // 200k tokens

// ── Layer 1: Token Tracking ────────────────────────

export class TokenTracker {
  private lastPreciseCount = 0; // 上次 API 返回的精确值
  private pendingChars = 0; // 新增消息的字符数

  updateFromAPI(promptTokens: number): void {
    this.lastPreciseCount = promptTokens;
    this.pendingChars = 0; // 精确值到了，清零增量
  }

  addMessage(message: ModelMessage): void {
    this.pendingChars += countMessageChars(message);
  }

  addMessages(messages: ModelMessage[]): void {
    for (const message of messages) {
      this.addMessage(message);
    }
  }

  replaceMessages(before: ModelMessage[], after: ModelMessage[]): void {
    this.pendingChars += countMessagesChars(after) - countMessagesChars(before);
  }

  get estimatedTokens(): number {
    return Math.max(0, this.lastPreciseCount + Math.ceil(this.pendingChars / 4));
  }

  get status(): { tokens: number; percent: number; needsAction: boolean } {
    const tokens = this.estimatedTokens;
    const percent = Math.round((tokens / CONTEXT_WINDOW) * 100);
    const needsAction = percent >= 75;
    return { tokens, percent, needsAction };
  }
}

function countMessageChars(message: ModelMessage): number {
  let chars = 0;

  if (typeof message.content === 'string') {
    chars += message.content.length;
  }

  if (!Array.isArray(message.content)) return chars;

  for (const part of message.content) {
    if ('text' in part && typeof part.text === 'string') {
      chars += part.text.length;
    } else if ('output' in part) {
      chars += toolResultOutputToText(part.output).length;
    } else if ('input' in part) {
      chars += JSON.stringify(part.input)?.length ?? 0;
    }
  }
  return chars;
}

function countMessagesChars(messages: ModelMessage[]): number {
  let chars = 0;
  for (const message of messages) {
    chars += countMessageChars(message);
  }
  return chars;
}

export function estimateMessageTokens(messages: ModelMessage[]): number {
  const chars = countMessagesChars(messages);
  // 4 chars per token, with 1.2x safety factor for Chinese
  return Math.ceil((chars / 4) * 1.2);
}

// ─── Layer 2: Dynamic Tool Result Truncation ────────────────────────

interface TruncationConfig {
  maxSingleResult: number; // 最大单条工具结果的字符数
  contextBudgetChars: number; // 上下文预算的字符数
}

// Default truncation config: 50% of context window for single result, 75% for context budget
const DEFAULT_TRUNCATION: TruncationConfig = {
  maxSingleResult: Math.floor(CONTEXT_WINDOW * 0.5 * 2), // 50% of context window, 2 chars per token
  contextBudgetChars: Math.floor(CONTEXT_WINDOW * 0.75 * 4), // 75% of context window, 4 chars per token
};

export function truncateToolResults(
  messages: ModelMessage[],
  config: TruncationConfig = DEFAULT_TRUNCATION,
): { messages: ModelMessage[]; truncated: number; compacted: number } {
  let truncated = 0;
  let compacted = 0;

  // Pass 1: Truncate single tool results that exceed maxSingleResult, but keep the rest of the message
  // intact(Head/Tail 60/40)
  const result = messages.map((msg) => {
    if (msg.role !== 'tool' || !Array.isArray(msg.content)) return msg;

    const newContent = msg.content.map((part) => {
      if (!('output' in part)) return part;

      const outputText = toolResultOutputToText(part.output);
      if (outputText.length <= config.maxSingleResult) return part;

      truncated++;
      const maxChars = config.maxSingleResult;
      const headSize = Math.floor(maxChars * 0.6);
      const tailSize = Math.floor(maxChars * 0.4);
      const head = outputText.slice(0, headSize);
      const tail = outputText.slice(-tailSize);
      const truncatedText = `${head}\n\n[truncated: ${outputText.length} → ${maxChars} chars]\n\n${tail}`;

      return { ...part, output: textToolResultOutput(truncatedText) };
    });

    return { ...msg, content: newContent };
  });

  // Pass 2: If the total context exceeds contextBudgetChars, compact oldest tool results first to free up space
  let totalChars = countMessagesChars(result);

  if (totalChars > config.contextBudgetChars) {
    for (let i = 0; i < result.length && totalChars > config.contextBudgetChars; i++) {
      const msg = result[i];

      if (msg.role !== 'tool' || !Array.isArray(msg.content)) continue;

      const msgContent = msg.content as ToolResultPart[];
      const toolName = msgContent[0]?.toolName ?? 'unknown';
      const oldSize = msgContent.reduce(
        (sum, part) => sum + (part.output ? toolResultOutputToText(part.output).length : 0),
        0,
      );

      result[i] = {
        ...msg,
        content: msgContent.map((part) => ({
          ...part,
          output: textToolResultOutput(`[compacted: ${toolName} output removed to free context]`),
        })),
      };

      totalChars -= oldSize;
      compacted++;
    }
  }

  return { messages: result, truncated, compacted };
}

// ─── Layer 3: TTL Pruning ────────────────────────

interface TTLPruningConfig {
  softTTLMs: number; // Soft TTL in milliseconds, after which messages are marked for pruning
  hardTTLMs: number; // Hard TTL in milliseconds, after which messages are forcibly pruned
  keepHeadTail: number; // Number of chars to keep at the head and tail of the tool results when soft pruning
}

const DEFAULT_TTL_PRUNING: TTLPruningConfig = {
  softTTLMs: 5 * 60 * 1000, // 5 minutes
  hardTTLMs: 10 * 60 * 1000, // 10 minutes
  keepHeadTail: 1500, // Keep 1500 chars at the head and tail of the tool results when soft pruning
};

export interface TTLPruningResult {
  messages: ModelMessage[];
  softPruned: number;
  hardPruned: number;
}

export function ttlPrune(
  messages: ModelMessage[],
  timestamps: Map<number, number>,
  config: TTLPruningConfig = DEFAULT_TTL_PRUNING,
): TTLPruningResult {
  let softPruned = 0;
  let hardPruned = 0;

  const now = Date.now();
  const result = messages.map((msg, idx) => {
    // Only prune tool results, never user/assistant messages
    if (msg.role !== 'tool' || !Array.isArray(msg.content)) return msg;

    const ts = timestamps.get(idx);
    if (!ts) return msg;

    const age = now - ts;

    // Preserve error experiences — never prune failed tool results
    const outputText = msg.content
      .map((part) => ('output' in part ? toolResultOutputToText(part.output) : ''))
      .join('');
    const isError = /error|失败|不存在|denied|refused|timeout/i.test(outputText);

    if (isError) return msg;

    // Hard clear: replace entire content with placeholder
    if (age >= config.hardTTLMs) {
      hardPruned++;
      const toolName = (msg.content[0] as ToolResultPart)?.toolName ?? 'unknown';
      return {
        ...msg,
        content: msg.content.map((part) => ({
          ...part,
          output: textToolResultOutput(`[tool result expired: ${toolName}]`),
        })),
      };
    }

    // Soft prune: keep head + tail, replace middle
    if (age >= config.softTTLMs) {
      const newContent = msg.content.map((part) => {
        if (!('output' in part)) return part;

        const outputText = toolResultOutputToText(part.output);
        if (outputText.length <= config.keepHeadTail * 2) return part;

        softPruned++;
        const head = outputText.slice(0, config.keepHeadTail);
        const tail = outputText.slice(-config.keepHeadTail);
        const removed = outputText.length - config.keepHeadTail * 2;

        return {
          ...part,
          output: textToolResultOutput(
            `${head}\n\n[soft pruned: ${removed} chars removed, content older than ${Math.round(config.softTTLMs / 60000)}min]\n\n${tail}`,
          ),
        };
      });

      return { ...msg, content: newContent };
    }

    return msg;
  });

  return { messages: result, softPruned, hardPruned };
}

// ── Combined Defense ─────────────────────────────────

export interface DefenseResult {
  messages: ModelMessage[];
  tokenEstimate: number;
  truncated: number;
  compacted: number;
  softPruned: number;
  hardPruned: number;
}

export function applyDefense(
  messages: ModelMessage[],
  timestamps: Map<number, number>,
): DefenseResult {
  const beforeTokens = estimateMessageTokens(messages);
  console.log(`\n=== Context Defense ===`);
  console.log(`[Before Defense] ${messages.length} messages, ~${beforeTokens} tokens`);

  // Layer 2: truncate oversized tool results
  const trunc = truncateToolResults(messages);
  console.log(
    `[Layer 2: Truncation] ${trunc.truncated} messages truncated, ${trunc.compacted} messages compacted`,
  );

  // Layer 3: TTL prune old tool results
  const prune = ttlPrune(trunc.messages, timestamps);
  console.log(
    `[Layer 3: TTL Pruning] ${prune.softPruned} messages soft-pruned, ${prune.hardPruned} messages hard-pruned`,
  );

  // Layer 1: estimate final token count
  const tokenEstimate = estimateMessageTokens(prune.messages);
  console.log(
    `[After Defense] ${prune.messages.length} messages, ~${tokenEstimate} tokens (saved ${beforeTokens - tokenEstimate} tokens)`,
  );
  console.log(`====================\n`);

  return {
    messages: prune.messages,
    tokenEstimate,
    truncated: trunc.truncated,
    compacted: trunc.compacted,
    softPruned: prune.softPruned,
    hardPruned: prune.hardPruned,
  };
}
