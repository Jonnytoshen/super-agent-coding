import TurndownService from 'turndown';
import type { ToolDefinition } from './tool-registry';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});
turndown.remove(['script', 'style', 'nav', 'footer', 'header', 'iframe']);

function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

export function WebFetch(): ToolDefinition {
  return {
    name: 'web_fetch',
    description: '抓取指定 URL 的网页内容，转换为 Markdown 格式。',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'HTTP(S) URL.' },
      },
      required: ['url'],
    },
    isConcurrencySafe: true,
    isReadOnly: true,
    maxResultChars: 3000,
    execute: async ({ url }: { url: string }) => {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SuperAgent/1.0)',
            Accept: 'text/html,application/xhtml+xml',
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) return `抓取失败: HTTP ${res.status}`;

        const html = await res.text();
        return htmlToMarkdown(html);
      } catch (err: unknown) {
        return `抓取失败: ${(err as Error).message}`;
      }
    },
  };
}
