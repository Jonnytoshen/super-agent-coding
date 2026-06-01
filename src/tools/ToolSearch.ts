import type { ToolDefinition, ToolRegistry } from './tool-registry';

export function ToolSearch(registry: ToolRegistry): ToolDefinition {
  return {
    name: 'tool_search',
    description:
      '获取延迟工具的完整定义。传入工具名（从系统提示的延迟工具列表中选取），返回该工具的完整参数 Schema',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '工具名，如 "mcp__github__list_issues"。支持逗号分隔多个工具名',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    isConcurrencySafe: true,
    isReadOnly: true,
    execute: async ({ query }: { query: string }) => {
      const results = registry.searchTools(query);
      if (results.length === 0) {
        return `没有找到匹配 "${query}" 的工具`;
      }
      return await Promise.resolve(
        results.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      );
    },
  };
}
