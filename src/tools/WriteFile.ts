import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ToolDefinition } from './tool-registry';

export function WriteFile(): ToolDefinition {
  return {
    name: 'write_file',
    description: '写入内容到指定文件',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
        content: { type: 'string', description: '要写入的内容' },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
    isConcurrencySafe: false, // 写操作不能并行
    isReadOnly: false,
    execute: async ({ path, content }: { path: string; content: string }) => {
      writeFileSync(resolve(path), content, 'utf-8');
      return await Promise.resolve(`已写入 ${content.length} 字符到 ${path}`);
    },
  };
}
