import { Injectable } from '@nestjs/common';
import { ToolCall, ToolResult } from '../types';
import { FileSystemToolService } from './filesystem-tool.service';
import { ToolDefinitions } from '../helpers/tool-definitions';

@Injectable()
export class ToolRegistryService {

  constructor(private readonly fsTools: FileSystemToolService) {}

  getTools(): any[] {
    return ToolDefinitions.list();
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    switch (call.name) {
      case 'list_files': return this.fsTools.list(call.arguments);
      case 'read_file': return this.fsTools.read(call.arguments);
      case 'save_file': return this.fsTools.save(call.arguments);
      default: return { success: false, error: `Unknown tool: ${call.name}` };
    }
  }
}
