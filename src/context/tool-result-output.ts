import type { ToolResultPart } from 'ai';

export type ToolResultOutput = ToolResultPart['output'];

export function textToolResultOutput(value: string): ToolResultOutput {
  return { type: 'text', value };
}

export function toolResultOutputToText(output: ToolResultOutput): string {
  switch (output.type) {
    case 'text':
    case 'error-text':
      return output.value;
    case 'json':
    case 'error-json':
      return JSON.stringify(output.value);
    case 'content':
      return output.value
        .map((part) => {
          switch (part.type) {
            case 'text':
              return part.text;
            case 'media':
            case 'file-data':
              return `[media: ${part.mediaType}]`;
            case 'file-url':
              return `[media: ${part.url}]`;
            default:
              return `[media]`;
          }
        })
        .join('\n');
    default:
      return '';
  }
}
