/**
 * 判断一个错误是否是可以重试的。
 *
 * 这个函数会检查错误消息中的 HTTP 状态码（如 429、500-599）和常见的网络错误（如连接重置、超时等）。对于 AI SDK 特有的流式错误（NoOutputGeneratedError）也会被识别为可重试。
 *
 * @param error 要检查的错误对象
 * @returns 如果错误是可以重试的，返回 true；否则返回 false
 */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message || '';

  // HTTP 状态码判断
  const statusMatch = message.match(/(\d{3})/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1]);
    if ([429, 529, 408].includes(status)) return true;
    if (status >= 500 && status < 600) return true;
    if (status >= 400 && status < 500) return false;
  }

  // 常见网络错误判断
  if (message.includes('ECONNRESET') || message.includes('EPIPE')) return true;
  if (message.includes('ETIMEDOUT') || message.includes('timeout')) return true;
  if (message.includes('fetch failed') || message.includes('network')) return true;

  // AI SDK 会把流式错误包装成 NoOutputGeneratedError
  if (message.includes('No output generated')) return true;

  return false;
}

/**
 * 计算重试延迟时间，使用指数退避算法，并添加随机抖动以避免同时重试导致的雪崩效应。
 *
 * @param attempt 当前重试次数，从 1 开始
 * @param baseMs 基础延迟时间（毫秒），默认 500ms
 * @param maxMs 最大延迟时间（毫秒），默认 30000ms（30秒）
 * @returns 计算得到的延迟时间（毫秒）
 *
 * `calculateDelay` 里有两个关键设计：
 *
 * **指数退避**：每次重试等的时间翻倍——500ms → 1000ms → 2000ms → 4000ms。这样避免了连续重试轰炸服务端，给它喘息的时间。
 *
 * **随机抖动（±25%）**：想象一个场景——API 服务端过载返回 429，你的 Agent 等 1 秒后重试。问题是，全世界所有收到 429 的客户端都在等 1 秒后重试。1 秒后，服务端被又一波请求冲击——更多的 429，更多的等 1 秒，形成一个越来越大的请求洪峰。这就是"惊群效应"（Thundering Herd）。
 *
 * 解法就是在退避的基础上加一个随机偏移。每个客户端等的时间不一样，请求就自然分散了。我们这里用的是
 * ±25% 的 Equal Jitter——说白了就是在算出来的退避时间上下浮动 25%（比如 1 秒就随机取 0.75~1.25 秒），
 * 每个客户端等的时间略有不同，自然就错开了。简单够用，延迟不会太极端。关于不同 Jitter 策略的对比，
 * AWS 有篇经典博客 [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) 讲得很透，感兴趣可以读一读。
 */
export function calculateDelay(attempt: number, baseMs = 500, maxMs = 30000): number {
  const exponential = baseMs * Math.pow(2, attempt - 1); // 指数退避
  const capped = Math.min(exponential, maxMs); // 上限控制
  const jitter = capped * 0.25; // 抖动范围 ±25%
  return Math.max(0, Math.round(capped + (Math.random() * 2 - 1) * jitter)); // 加抖动并确保不小于 0
}

/**
 * 这是一个简单的 sleep 函数，返回一个 Promise，在指定的毫秒数后 resolve。
 *
 * @param ms 要等待的时间（毫秒）
 * @returns 一个 Promise，在指定时间后 resolve
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
