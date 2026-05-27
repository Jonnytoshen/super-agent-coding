import type { ToolDefinition } from './tool-registry';

export function Calculator(): ToolDefinition {
  return {
    name: 'calculator',
    description: '计算数学表达式的结果。当用户提问涉及数学运算时使用',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: '数学表达式，如 "2 + 3 * 4"' },
      },
      required: ['expression'],
      additionalProperties: false,
    },
    isConcurrencySafe: true,
    isReadOnly: true,
    execute: async ({ expression }: { expression: string }) => {
      try {
        // 生产环境不要用 eval，这里纯粹为了演示
        // eslint-disable-next-line
        const result = new Function(`return ${expression}`)();
        return Promise.resolve(`${expression} = ${result}`);
      } catch {
        return Promise.resolve(`无法计算: ${expression}`);
      }
    },
  };
}
