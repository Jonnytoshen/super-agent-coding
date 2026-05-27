import { join, resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import type { ToolDefinition } from './tool-registry';

export function ListDirectory(): ToolDefinition {
  return {
    name: 'list_directory',
    description: '列出指定目录下的文件和子目录',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目录路径，默认为当前目录' },
      },
      required: [],
      additionalProperties: false,
    },
    isConcurrencySafe: true,
    isReadOnly: true,
    execute: async ({ path = '.' }: { path?: string }) => {
      const resolved = resolve(path);
      const dirList = readdirSync(resolved)
        .map((name) => {
          const stat = statSync(join(resolved, name));
          return `${stat.isDirectory() ? '[DIR]' : '[FILE]'} ${name}`;
        })
        .join('\n');
      return await Promise.resolve(dirList);
    },
  };
}
