import { jsonSchema } from 'ai';
import type { SafeAny } from '../types';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;

  // 元数据——给 Agent Loop 做决策用
  isConcurrencySafe?: boolean; // 能否并行
  isReadOnly?: boolean; // 是否只读
  maxResultChars?: number; // 结果最大长度

  // 执行函数，输入参数已被验证为 parameters 定义的格式
  execute: (input: SafeAny) => Promise<unknown>;
}

const DEFAULT_MAX_RESULT_CHARS = 3000;

/**
 * ToolRegistry 负责管理工具定义，并提供转换为 AI SDK 格式的接口
 */
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(...tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  toAISDKFormat(): Record<string, SafeAny> {
    const result: Record<string, SafeAny> = {};
    for (const [name, tool] of this.tools) {
      const maxChars = tool.maxResultChars;
      const executeFn = tool.execute;
      result[name] = {
        description: tool.description,
        inputSchema: jsonSchema(tool.parameters),
        execute: async (input: SafeAny) => {
          const raw = await executeFn(input);
          const text = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
          return truncateResult(text, maxChars);
        },
      };
    }
    return result;
  }
}

/**
 * 截断工具结果，保留头部和尾部，省略中间部分
 *
 * 如果结果文本超过 maxChars，则保留前 60% 和后 40%，并在中间插入省略提示
 *
 * @param text 原始文本
 * @param maxChars 最大字符数，默认 3000
 * @returns 截断后的文本
 */
export function truncateResult(text: string, maxChars: number = DEFAULT_MAX_RESULT_CHARS): string {
  if (text.length <= maxChars) return text;

  const headSize = Math.floor(maxChars * 0.6);
  const tailSize = maxChars - headSize;
  const head = text.slice(0, headSize);
  const tail = text.slice(-tailSize);
  const dropped = text.length - headSize - tailSize;

  return `${head}\n\n... [省略 ${dropped} 字符] ...\n\n${tail}`;
}
