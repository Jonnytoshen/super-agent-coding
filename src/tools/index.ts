import type { ToolDefinition } from './tool-registry';
import { Bash } from './Bash';
import { Calculator } from './Calculator';
import { EditFile } from './EditFile';
import { Glob } from './Glob';
import { Grep } from './Grep';
import { ListDirectory } from './ListDirectory';
import { ReadFile } from './ReadFile';
import { StartPreview } from './StartPreview';
import { Weather } from './Weather';
import { WriteFile } from './WriteFile';

export const tools: ToolDefinition[] = [
  Bash(),
  Calculator(),
  EditFile(),
  Glob(),
  Grep(),
  ListDirectory(),
  ReadFile(),
  StartPreview(),
  Weather(),
  WriteFile(),
];

export { type ToolDefinition, ToolRegistry } from './tool-registry';
