import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { ToolDefinition } from './tool-registry';

/**
 * 在文件或目录中搜索匹配指定模式的内容。返回匹配的行号和内容。
 * 这个工具可以让模型在不离开上下文的情况下，快速定位代码或文本中的关键信息，辅助分析和决策。
 */
export function Grep(): ToolDefinition {
  return {
    name: 'grep',
    description: '在文件中搜索匹配指定模式的内容。返回匹配的行号和内容',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: '搜索模式（正则表达式）' },
        path: { type: 'string', description: '搜索路径（文件或目录），默认当前目录' },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
    isConcurrencySafe: true,
    isReadOnly: true,
    maxResultChars: 3000, // 限制返回结果的长度，避免一次返回过多内容
    execute: async ({ pattern, path = '.' }: { pattern: string; path?: string }) => {
      const baseDir = resolve(path);
      const regex = new RegExp(pattern, 'i');
      const matches: string[] = [];
      const SKIP = new Set(['node_modules', '.git', 'dist']);
      const BIN_EXT = new Set(['.png', '.jpg', '.gif', '.woff', '.woff2', '.ico', '.lock']);

      function searchFile(filePath: string) {
        if (matches.length >= 50) return;
        const ext = filePath.slice(filePath.lastIndexOf('.'));
        if (BIN_EXT.has(ext)) return;

        let content: string;
        try {
          content = readFileSync(filePath, 'utf-8');
        } catch {
          return;
        }

        const lines = content.split('\n');
        const rel = relative(baseDir, filePath);
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            matches.push(`${rel}:${i + 1}: ${lines[i].trimEnd()}`);
            if (matches.length >= 50) return;
          }
        }
      }

      function walk(dir: string) {
        if (matches.length >= 50) return;
        let entries: string[];
        try {
          entries = readdirSync(dir);
        } catch {
          return;
        }

        for (const name of entries) {
          if (SKIP.has(name)) continue;
          const full = join(dir, name);
          try {
            const stat = statSync(full);
            if (stat.isDirectory()) {
              walk(full);
            } else {
              searchFile(full);
            }
          } catch {
            /* skip */
          }
        }
      }

      const stat = statSync(baseDir);
      if (stat.isFile()) {
        searchFile(baseDir);
      } else {
        walk(baseDir);
      }

      if (matches.length === 0) {
        return await Promise.resolve(`没有找到匹配 "${pattern}" 的内容`);
      }
      const suffix = matches.length >= 50 ? '\n... (结果已截断，共 50+ 条匹配)' : '';
      return await Promise.resolve(matches.join('\n') + suffix);
    },
  };
}
