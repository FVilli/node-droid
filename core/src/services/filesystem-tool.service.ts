import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
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

  search({ query, path: p = '.', caseSensitive = false, maxResults = 50 }: any): ToolResult {
    if (!query || typeof query !== 'string') {
      return { success: false, error: 'Missing query' };
    }
    const base = this.resolve(p);
    const needle = caseSensitive ? query : query.toLowerCase();
    const results: Array<{ path: string; line: number; preview: string }> = [];
    const max = Number.isFinite(maxResults) ? Math.max(1, Math.floor(maxResults)) : 50;

    try {
      this.walkFiles(base, (filePath) => {
        if (results.length >= max) return false;
        const relPath = path.relative(this.repoContext.get().codePath, filePath);
        let content = '';
        try {
          const stat = fs.statSync(filePath);
          if (stat.size > 200_000) return true;
          content = fs.readFileSync(filePath, 'utf-8');
        } catch {
          return true;
        }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const hay = caseSensitive ? lines[i] : lines[i].toLowerCase();
          if (hay.includes(needle)) {
            results.push({ path: relPath, line: i + 1, preview: lines[i].trim() });
            if (results.length >= max) return false;
          }
        }
        return true;
      });
      return { success: true, output: results };
    } catch (e) {
      return { success: false, error: `Failed to search files: ${(e as Error).message}` };
    }
  }

  searchFile({ query, path: p = '.', caseSensitive = false, maxResults = 50 }: any): ToolResult {
    if (!query || typeof query !== 'string') {
      return { success: false, error: 'Missing query' };
    }
    const base = this.resolve(p);
    const needle = caseSensitive ? query : query.toLowerCase();
    const results: string[] = [];
    const max = Number.isFinite(maxResults) ? Math.max(1, Math.floor(maxResults)) : 50;

    try {
      this.walkFiles(base, (filePath) => {
        if (results.length >= max) return false;
        const name = path.basename(filePath);
        const hay = caseSensitive ? name : name.toLowerCase();
        if (hay.includes(needle)) {
          results.push(path.relative(this.repoContext.get().codePath, filePath));
          if (results.length >= max) return false;
        }
        return true;
      });
      return { success: true, output: results };
    } catch (e) {
      return { success: false, error: `Failed to search file names: ${(e as Error).message}` };
    }
  }

  private walkFiles(root: string, onFile: (filePath: string) => boolean): void {
    const ignore = new Set(['.git', 'node_modules', 'dist', '.ai']);
    const stack: string[] = [root];
    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (ignore.has(entry.name)) continue;
          stack.push(full);
          continue;
        }
        if (!entry.isFile()) continue;
        const shouldContinue = onFile(full);
        if (!shouldContinue) return;
      }
    }
  }

}
