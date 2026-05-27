import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { ToolDefinition } from './tool-registry';

export function EditFile(): ToolDefinition {
  return {
    name: 'edit_file',
    description:
      '精确替换文件中的指定内容。用 old_string 定位要替换的文本，用 new_string 替换它。不是全量覆写——只改你指定的部分',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
        old_string: { type: 'string', description: '要被替换的原始文本（必须精确匹配）' },
        new_string: { type: 'string', description: '替换后的新文本' },
      },
      required: ['path', 'old_string', 'new_string'],
      additionalProperties: false,
    },
    isConcurrencySafe: false,
    isReadOnly: false,
    execute: async ({
      path,
      old_string,
      new_string,
    }: {
      path: string;
      old_string: string;
      new_string: string;
    }) => {
      const resolved = resolve(path);
      if (!existsSync(resolved)) return `文件不存在: ${path}`;

      const content = readFileSync(resolved, 'utf-8');
      const count = content.split(old_string).length - 1;

      // 模型给的 old_string 在文件里根本不存在。最常见的原因是模型记错了缩进或者多了少了一个空格。
      // 返回明确的错误信息，让模型知道"你的匹配不对，再看看"。
      if (count === 0) {
        return await Promise.resolve(
          `未找到匹配内容。请检查 old_string 是否与文件中的文本完全一致（包括空格和换行）`,
        );
      }

      // old_string 在文件里出现了多次。这时候直接替换会改错地方。让模型提供更多上下文（比如多包含前后
      // 几行），确保唯一匹配。
      if (count > 1) {
        return await Promise.resolve(`找到 ${count} 处匹配，请提供更多上下文让 old_string 唯一`);
      }

      const updated = content.replace(old_string, new_string);
      writeFileSync(resolved, updated, 'utf-8');
      return await Promise.resolve(
        `已替换 ${path} 中的内容（${old_string.length} → ${new_string.length} 字符）`,
      );
    },
  };
}
