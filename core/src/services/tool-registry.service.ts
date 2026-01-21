import { Injectable } from '@nestjs/common';
import { ToolCall, ToolResult } from '../interfaces';
import { FileSystemToolService } from './filesystem-tool.service';

@Injectable()
export class ToolRegistryService {

  constructor(private readonly fsTools: FileSystemToolService) {}

  getTools(): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'list_files',
          description: 'List files in a directory relative to the repo root.',
          parameters: {
            type: 'object',
            properties: { path: { type: 'string' } }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read a text file from the repo.',
          parameters: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'apply_patch',
          description: 'Apply a unified diff patch to a file.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              patch: { type: 'string' }
            },
            required: ['path', 'patch']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_file',
          description: 'Create a new file with provided content.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['path', 'content']
          }
        }
      },
    ];
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    switch (call.name) {
      case 'list_files': return this.fsTools.list(call.arguments);
      case 'read_file': return this.fsTools.read(call.arguments);
      case 'apply_patch': return this.fsTools.applyPatch(call.arguments);
      case 'create_file': return this.fsTools.createFile(call.arguments);
      default: return { success: false, error: `Unknown tool: ${call.name}` };
    }
  }
}
