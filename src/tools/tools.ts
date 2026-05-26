import type { ToolDefinition } from './tool-registry';
import { BashTool } from './BashTool';
import { CalculatorTool } from './CalculatorTool';
import { EditFileTool } from './EditFileTool';
import { FetchUrlTool } from './FetchUrlTool';
import { GlobTool } from './GlobTool';
import { GrepTool } from './GrepTool';
import { ListDirectoryTool } from './ListDirectoryTool';
import { ReadFileTool } from './ReadFileTool';
import { StartPreviewTool } from './StartPreviewTool';
import { WeatherTool } from './WeatherTool';
import { WriteFileTool } from './WriteFileTool';

/**
 * 这里定义了所有可用的工具列表，供系统调用
 */
export const allTools: ToolDefinition[] = [
  BashTool,
  CalculatorTool,
  EditFileTool,
  FetchUrlTool,
  GlobTool,
  GrepTool,
  ListDirectoryTool,
  ReadFileTool,
  StartPreviewTool,
  WriteFileTool,
  WeatherTool,
];
