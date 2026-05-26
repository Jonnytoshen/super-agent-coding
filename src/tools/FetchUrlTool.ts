import type { SafeAny } from '../types';
import type { ToolDefinition } from './tool-registry';

export const FetchUrlTool: ToolDefinition = {
  name: 'fetch_url',
  description: '抓取指定 URL 的网页内容并转换为纯文本（自动剥离 HTML 标签）',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '完整 URL，必须以 http:// 或 https:// 开头' },
    },
    required: ['url'],
    additionalProperties: false,
  },
  isConcurrencySafe: true, // 只读、可并发——抓多个 URL 时直接并行
  isReadOnly: true,
  maxResultChars: 1500, // 网页通常很长，截断兜底
  execute: async ({ url }: { url: string }) => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 SuperAgent' },
        signal: AbortSignal.timeout(10000), // 10 秒超时，避免卡死过久
      });
      if (!res.ok) return `请求失败：HTTP ${res.status}`;
      const html = await res.text();
      return (
        html
          .replace(/<script[\s\S]*?<\/script>/gi, '') // 去掉脚本标签及内容，避免暴露敏感信息或执行恶意代码
          .replace(/<style[\s\S]*?<\/style>/gi, '') // 去掉样式标签及内容，减少无用文本
          .replace(/<[^>]+>/g, ' ') // 去掉所有 HTML 标签，保留文本内容
          .replace(/\s+/g, ' ') // 将连续的空白字符替换为单个空格，清理文本
          .trim() || '页面无文本内容'
      );
    } catch (err: unknown) {
      return `抓取失败：${(err as SafeAny).message}`;
    }
  },
};
