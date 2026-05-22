import type { ToolDefinition } from './tool-registry';
import { CalculatorTool } from './CalculatorTool';
import { ListDirectoryTool } from './ListDirectoryTool';
import { ReadFileTool } from './ReadFileTool';
import { WeatherTool } from './WeatherTool';
import { WriteFileTool } from './WriteFileTool';

/**
 * 这里定义了所有可用的工具列表，供系统调用
 */
export const allTools: ToolDefinition[] = [
  CalculatorTool,
  ListDirectoryTool,
  ReadFileTool,
  WriteFileTool,
  WeatherTool,
];
