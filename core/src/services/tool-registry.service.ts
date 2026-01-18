import { Injectable } from '@nestjs/common';
import { ToolCall, ToolResult } from '../interfaces';
import { FileSystemToolService } from './filesystem-tool.service';

@Injectable()
export class ToolRegistryService {

  constructor(private readonly fsTools: FileSystemToolService) {}

  async execute(call: ToolCall): Promise<ToolResult> {
    switch (call.name) {
      case 'list_files': return this.fsTools.list(call.arguments);
      case 'read_file': return this.fsTools.read(call.arguments);
      case 'apply_patch': return this.fsTools.applyPatch(call.arguments);
      case 'create_file': return this.fsTools.createFile(call.arguments);
      case 'delete_file': return this.fsTools.deleteFile(call.arguments);
      default: return { success: false, error: `Unknown tool: ${call.name}` };
    }
  }
}
