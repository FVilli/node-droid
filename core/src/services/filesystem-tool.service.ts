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
    return { success: true, output: fs.readdirSync(full) };
  }

  read({ path: p }: any): ToolResult {
    const full = this.resolve(p);
    return { success: true, output: fs.readFileSync(full, 'utf-8') };
  }

  saveFile({ path: p, content }: any): ToolResult {
    const full = this.resolve(p);
    fs.writeFileSync(full, content);
    return { success: true };
  }

}
