import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { RepoContextService } from './repo-context.service';
import { ToolResult } from '../interfaces';

@Injectable()
export class FileSystemToolService {

  constructor(private readonly repoContext: RepoContextService) {}

  private resolve(p: string) {
    const base = this.repoContext.get().codePath;
    const full = path.resolve(base, p);
    if (!full.startsWith(base)) throw new Error('Path escape detected');
    return full;
  }

  list({ path: p = '.' }: any): ToolResult {
    const full = this.resolve(p);
    return { success: true, output: fs.readdirSync(full) };
  }

  read({ path: p }: any): ToolResult {
    const full = this.resolve(p);
    return { success: true, output: fs.readFileSync(full, 'utf-8') };
  }

  applyPatch({ path: p, patch }: any): ToolResult {
    // TODO: applicazione patch unificata
    return { success: false, error: 'applyPatch not implemented' };
  }

  createFile({ path: p, content }: any): ToolResult {
    const full = this.resolve(p);
    fs.writeFileSync(full, content);
    return { success: true };
  }

  deleteFile({ path: p }: any): ToolResult {
    const full = this.resolve(p);
    fs.unlinkSync(full);
    return { success: true };
  }
}
