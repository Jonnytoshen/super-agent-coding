import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ToolDefinition } from './tool-registry';

export function ReadFile(): ToolDefinition {
  return {
    name: 'read_file',
    description: '读取指定路径的文件内容',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    isConcurrencySafe: true,
    isReadOnly: true,
    maxResultChars: 500, // 演示用，生产环境通常 50000+
    execute: async ({ path }: { path: string }) => {
      return await Promise.resolve(readFileSync(resolve(path), 'utf-8'));
    },
  };
}
