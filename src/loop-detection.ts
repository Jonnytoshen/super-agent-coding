/**
 * 这个模块实现了一个简单的工具调用循环检测器，用于监控 Agent 在调用工具时是否可能陷入了循环。
 * 目前实现了三种检测器：
 * 1. generic_repeat：检测同一工具同一参数的重复调用
 * 2. ping_pong：检测两个不同调用交替出现的乒乓循环
 * 3. global_circuit_breaker：检测同一调用连续多次且无结果变化的死循环
 *
 * 每次工具调用前，Agent 都会调用 `recordCall` 来记录调用信息，工具执行完毕后调用 `recordResult` 来记录结果信息。
 * `detect` 函数会根据当前调用和历史记录来判断是否可能陷入循环，并返回相应的检测结果。
 *
 * 注意：这个实现是一个基础版本，实际应用中可能需要根据具体情况调整阈值、增加更多类型的检测器，或者引入更多上下文信息来提高检测的准确性。
 *
 * 检测到重复后不是一刀切，而是三级响应：
 * - Warning：5 次，注入系统提醒消息，让模型"醒过来"换策略
 * - Critical：8 次，阻断工具调用，强制停止循环
 * - Breaker(全局熔断)：10 次，无论什么情况，强制停止
 *
 * 为什么不在第一次重复就停？我觉得这里有个很重要的取舍：误杀的代价太大。把一个正在正常工作的 Agent 强行停了，比让它多跑几轮更浪费。先软后硬，给模型自救的机会。
 */

import { createHash } from 'node:crypto';

export interface ToolCallRecord {
  toolName: string;
  argsHash: string;
  resultHash?: string;
  timestamp: number;
}

export type DetectorKind = 'generic_repeat' | 'ping_pong' | 'global_circuit_breaker';

export type DetectionResult =
  | { stuck: false }
  | {
      stuck: true;
      level: 'warning' | 'critical';
      detector: DetectorKind;
      count: number;
      message: string;
    };

const HISTORY_SIZE = 30; // 滑动窗口大小
const WARNING_THRESHOLD = 5; // 警告阈值（演示用，生产环境通常是 10）
const CRITICAL_THRESHOLD = 8; // 严重阈值（演示用，生产环境通常是 20）
const BREAKER_THRESHOLD = 10; // 熔断阈值（演示用，生产环境通常是 30）

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

function hash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

export function hashToolCall(toolName: string, params: unknown): string {
  return `${toolName}:${hash(stableStringify(params))}`;
}

export function hashResult(result: unknown): string {
  return hash(stableStringify(result));
}

// 全局调用历史，记录最近的工具调用信息
const history: ToolCallRecord[] = [];

/**
 * 这个函数在工具调用前被调用，用于记录工具调用的基本信息（工具名和参数的哈希值）。
 * 这样我们就有了一个调用历史，可以用来检测重复调用和循环。
 *
 * 注意：这个函数只记录调用信息，不记录结果。结果是在工具执行完毕后通过 `recordResult` 来记录的。
 */
export function recordCall(toolName: string, params: unknown): void {
  history.push({
    toolName,
    argsHash: hashToolCall(toolName, params),
    timestamp: Date.now(),
  });
  if (history.length > HISTORY_SIZE) history.shift();
}

/**
 * 这个函数在工具执行完毕后被调用，用于记录工具调用的结果。
 * 它会找到最近一次相同工具相同参数的调用记录，并把结果的哈希值更新进去。
 * 这样我们就能通过比较结果哈希来判断工具调用是否有进展了。
 */
export function recordResult(toolName: string, params: unknown, result: unknown): void {
  const argsHash = hashToolCall(toolName, params);
  const resultH = hashResult(result);
  for (let i = history.length - 1; i >= 0; i--) {
    if (
      history[i].toolName === toolName &&
      history[i].argsHash === argsHash &&
      !history[i].resultHash
    ) {
      history[i].resultHash = resultH;
      break;
    }
  }
}

export function resetHistory(): void {
  history.length = 0;
}

/**
 * 获取同一工具同一参数的连续调用次数，直到结果发生变化为止。
 * 例如：A-B-C-A-B 这个序列中，如果当前调用是 A，那么它的 no-progress streak 是 2（最后两个 A 之前没有结果变化）。
 */
function getNoProgressStreak(toolName: string, argsHash: string): number {
  let streak = 0;
  let lastResultHash: string | undefined;
  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i];
    if (r.toolName !== toolName || r.argsHash !== argsHash) continue;
    if (!r.resultHash) continue;
    if (!lastResultHash) {
      lastResultHash = r.resultHash;
      streak = 1;
      continue;
    }
    if (r.resultHash !== lastResultHash) break;
    streak++;
  }
  return streak;
}

/**
 * 获取当前调用是否与之前的调用形成了 ping-pong 循环。
 * 例如：A-B-A-B 或者 A-B-C-A-B-C 这样的模式。
 */
function getPingPongCount(currentHash: string): number {
  if (history.length < 3) return 0;
  const last = history[history.length - 1];
  let otherHash: string | undefined;
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i].argsHash !== last.argsHash) {
      otherHash = history[i].argsHash;
      break;
    }
  }
  if (!otherHash) return 0;
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const expected = count % 2 === 0 ? last.argsHash : otherHash;
    if (history[i].argsHash !== expected) break;
    count++;
  }
  if (currentHash === otherHash && count >= 2) return count + 1;
  return 0;
}

/**
 * 检测工具调用是否可能陷入循环。
 * 目前实现了三种检测器：
 * 1. generic_repeat：检测同一工具同一参数的重复调用
 * 2. ping_pong：检测两个不同调用交替出现的乒乓循环
 * 3. global_circuit_breaker：检测同一调用连续多次且无结果变化的死循环
 */
export function detect(toolName: string, params: unknown): DetectionResult {
  const argsHash = hashToolCall(toolName, params);
  const noProgress = getNoProgressStreak(toolName, argsHash);

  if (noProgress >= BREAKER_THRESHOLD) {
    return {
      stuck: true,
      level: 'critical',
      detector: 'global_circuit_breaker',
      count: noProgress,
      message: `[熔断] ${toolName} 已重复 ${noProgress} 次且无进展，强制停止`,
    };
  }

  const pingPong = getPingPongCount(argsHash);
  if (pingPong >= CRITICAL_THRESHOLD) {
    return {
      stuck: true,
      level: 'critical',
      detector: 'ping_pong',
      count: pingPong,
      message: `[熔断] 检测到乒乓循环（${pingPong} 次交替），强制停止`,
    };
  }
  if (pingPong >= WARNING_THRESHOLD) {
    return {
      stuck: true,
      level: 'warning',
      detector: 'ping_pong',
      count: pingPong,
      message: `[警告] 检测到乒乓循环（${pingPong} 次交替），建议换个思路`,
    };
  }

  const recentCount = history.filter(
    (h) => h.toolName === toolName && h.argsHash === argsHash,
  ).length;
  if (recentCount >= CRITICAL_THRESHOLD) {
    return {
      stuck: true,
      level: 'critical',
      detector: 'generic_repeat',
      count: recentCount,
      message: `[熔断] ${toolName} 相同参数已调用 ${recentCount} 次，强制停止`,
    };
  }
  if (recentCount >= WARNING_THRESHOLD) {
    return {
      stuck: true,
      level: 'warning',
      detector: 'generic_repeat',
      count: recentCount,
      message: `[警告] ${toolName} 相同参数已调用 ${recentCount} 次，你可能陷入了重复`,
    };
  }

  return { stuck: false };
}
