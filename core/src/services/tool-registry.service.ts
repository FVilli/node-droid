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
      case 'list_files':
        return this.fsTools.listFiles(call.arguments);
      case 'get_folder_content':
        return this.fsTools.list(call.arguments);
      case 'read_file_range':
        return this.fsTools.readRange(call.arguments);
      case 'read_file':
        return this.fsTools.read(call.arguments);
      case 'create_file':
        return this.fsTools.create(call.arguments);
      case 'replace_in_file':
        return this.fsTools.replace(call.arguments);
      case 'insert_in_file':
        return this.fsTools.insert(call.arguments);
      case 'save_file':
        return this.fsTools.save(call.arguments);
      case 'search':
        return this.fsTools.search(call.arguments);
      case 'search_file':
        return this.fsTools.searchFile(call.arguments);
      default:
        return { success: false, error: `Unknown tool: ${call.name}` };
    }
  }
}
