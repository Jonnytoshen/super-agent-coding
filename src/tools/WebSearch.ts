import { SERPER_API_KEY, TAVILY_API_KEY } from '../config';
import type { SafeAny } from '../types';
import type { ToolDefinition } from './tool-registry';

/**
 * 创建一个基于 Tavily API 的网络搜索工具定义。
 * @param apiKey 可选的 Tavily API 密钥，如果未提供则执行函数会返回提示信息。
 * @returns 一个符合 ToolDefinition 接口的对象，用于在系统中注册和使用网络搜索功能。
 */
export function TavilyWebSearch(apiKey?: string): ToolDefinition {
  return {
    name: 'web_search',
    description: '搜索互联网获取最新信息。返回相关网页的标题、链接和内容摘要',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        max_results: { type: 'number', description: '返回结果数量，默认 5' },
      },
      required: ['query'],
    },
    isConcurrencySafe: true,
    isReadOnly: true,
    maxResultChars: 3000,
    execute: async ({ query, max_results = 5 }: { query: string; max_results?: number }) => {
      if (!apiKey) return '[web_search] 未配置 TAVILY_API_KEY，请在 .env 中设置';

      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results,
          include_answer: true,
        }),
      });

      if (!res.ok) return `[web_search] 请求失败: HTTP ${res.status}`;

      const data = await res.json();
      const lines: string[] = [];

      if (data.answer) {
        lines.push(`## AI 摘要\n${data.answer}\n`);
      }

      for (const r of data.results || []) {
        lines.push(`### ${r.title}`);
        lines.push(r.url as string);
        lines.push((r.content || r.snippet || '') as string);
        lines.push('');
      }

      return lines.join('\n') || '没有找到相关结果';
    },
  };
}

/**
 * 创建一个基于 Serper API 的网络搜索工具定义。
 * @param apiKey 可选的 Serper API 密钥，如果未提供则执行函数会返回提示信息。
 * @returns 一个符合 ToolDefinition 接口的对象，用于在系统中注册和使用网络搜索功能。
 */
export function SerperWebSearch(apiKey?: string): ToolDefinition {
  return {
    name: 'web_search',
    description:
      '搜索互联网获取最新信息。返回 Google 搜索结果的标题、链接和摘要，可搭配 web_fetch 工具获取网页详细内容。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        max_results: { type: 'number', description: '返回结果数量，默认 5' },
      },
      required: ['query'],
    },
    isConcurrencySafe: true,
    isReadOnly: true,
    maxResultChars: 3000,
    execute: async ({ query, max_results = 5 }: { query: string; max_results?: number }) => {
      if (!apiKey) return '[web_search] 未配置 SERPER_API_KEY，请在 .env 中设置';

      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: max_results }),
      });

      if (!res.ok) return `[web_search] 请求失败: HTTP ${res.status}`;

      const data = await res.json();
      const lines: string[] = [];

      // Knowledge Graph（如果有）
      if (data.knowledgeGraph) {
        const kg = data.knowledgeGraph;
        lines.push(`## ${kg.title}`);
        if (kg.description) lines.push(kg.description as string);
        lines.push('');
      }

      // Organic Results
      const organicResults = (data.organic || []) as SafeAny[];
      for (const r of organicResults.slice(0, max_results)) {
        lines.push(`### ${r.title}`);
        lines.push(r.link as string);
        lines.push((r.snippet || '') as string);
        lines.push('');
      }

      return lines.join('\n') || '没有找到相关结果';
    },
  };
}

/**
 * 根据环境变量配置，返回一个适合的网络搜索工具定义。
 * 优先使用 Tavily API，如果未配置则尝试 Serper API，如果两者都未配置则返回一个默认的 Tavily 版本，提示用户配置 API KEY。
 * @returns 一个符合 ToolDefinition 接口的对象，用于在系统中注册和使用网络搜索功能。
 */
export function WebSearch(): ToolDefinition {
  if (TAVILY_API_KEY) return TavilyWebSearch(TAVILY_API_KEY);
  if (SERPER_API_KEY) return SerperWebSearch(SERPER_API_KEY);
  return TavilyWebSearch(); // 默认返回 Tavily 版本，提示用户配置 API KEY
}
