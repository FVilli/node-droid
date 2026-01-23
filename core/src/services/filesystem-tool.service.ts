import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { RepoContextService } from './repo-context.service';
import { ToolResult } from '../types';
import { FileSystemPaths } from '../helpers/filesystem-paths';

@Injectable()
export class FileSystemToolService {

  constructor(private readonly repoContext: RepoContextService) {}

  private resolve(p: string) {
    const base = this.repoContext.get().codePath;
    return FileSystemPaths.resolve(base, p);
  }

  list({ path: p = '.' }: any): ToolResult {
    const full = this.resolve(p);
    try {
      return { success: true, output: fs.readdirSync(full) };
    } catch (e) {
      return { success: false, error: `Failed to list directory: ${(e as Error).message}` };
    }
  }

  read({ path: p }: any): ToolResult {
    const full = this.resolve(p);
    try {
      return { success: true, output: fs.readFileSync(full, 'utf-8') };
    } catch (e) {
      return { success: false, error: `Failed to read file: ${(e as Error).message}` };
    }
  }

  save({ path: p, content }: any): ToolResult {
    const full = this.resolve(p);
    try {
      fs.writeFileSync(full, content);
      return { success: true };
    } catch (e) {
      return { success: false, error: `Failed to save file: ${(e as Error).message}` };
    }
  }

}
