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
      return {
        success: false,
        error: `Failed to list directory: ${(e as Error).message}`,
      };
    }
  }

  listFiles({ path: p = '.' }: any): ToolResult {
    return this.list({ path: p });
  }

  read({ path: p }: any): ToolResult {
    const full = this.resolve(p);
    try {
      return { success: true, output: fs.readFileSync(full, 'utf-8') };
    } catch (e) {
      return {
        success: false,
        error: `Failed to read file: ${(e as Error).message}`,
      };
    }
  }

  readRange({ path: p, startLine, endLine }: any): ToolResult {
    const full = this.resolve(p);
    const start = Number(startLine);
    const end = Number(endLine);
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end < start
    ) {
      return { success: false, error: 'Invalid startLine/endLine' };
    }
    try {
      const content = fs.readFileSync(full, 'utf-8');
      const lines = content.split('\n');
      const selected = lines.slice(start - 1, end);
      return {
        success: true,
        output: {
          path: p,
          startLine: start,
          endLine: Math.min(end, lines.length),
          content: selected.join('\n'),
        },
      };
    } catch (e) {
      return {
        success: false,
        error: `Failed to read file range: ${(e as Error).message}`,
      };
    }
  }

  save({ path: p, content }: any): ToolResult {
    const full = this.resolve(p);
    try {
      fs.writeFileSync(full, content);
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: `Failed to save file: ${(e as Error).message}`,
      };
    }
  }

  create({ path: p, content }: any): ToolResult {
    const full = this.resolve(p);
    try {
      if (fs.existsSync(full)) {
        return { success: false, error: 'File already exists' };
      }
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content ?? '', 'utf-8');
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: `Failed to create file: ${(e as Error).message}`,
      };
    }
  }

  replace({ path: p, search, replace, all = false }: any): ToolResult {
    const full = this.resolve(p);
    if (typeof search !== 'string' || search.length === 0) {
      return { success: false, error: 'Missing search text' };
    }
    if (typeof replace !== 'string') {
      return { success: false, error: 'Missing replacement text' };
    }
    try {
      const original = fs.readFileSync(full, 'utf-8');
      if (!original.includes(search)) {
        return { success: false, error: 'Search text not found' };
      }
      const updated = all
        ? original.split(search).join(replace)
        : original.replace(search, replace);
      fs.writeFileSync(full, updated, 'utf-8');
      const replacements = all ? original.split(search).length - 1 : 1;
      return { success: true, output: { replacements } };
    } catch (e) {
      return {
        success: false,
        error: `Failed to replace in file: ${(e as Error).message}`,
      };
    }
  }

  search({
    query,
    path: p = '.',
    caseSensitive = false,
    maxResults = 50,
  }: any): ToolResult {
    if (!query || typeof query !== 'string') {
      return { success: false, error: 'Missing query' };
    }
    const base = this.resolve(p);
    const needle = caseSensitive ? query : query.toLowerCase();
    const results: Array<{ path: string; line: number; preview: string }> = [];
    const max = Number.isFinite(maxResults)
      ? Math.max(1, Math.floor(maxResults))
      : 50;

    try {
      this.walkFiles(base, (filePath) => {
        if (results.length >= max) return false;
        const relPath = path.relative(
          this.repoContext.get().codePath,
          filePath,
        );
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
            results.push({
              path: relPath,
              line: i + 1,
              preview: lines[i].trim(),
            });
            if (results.length >= max) return false;
          }
        }
        return true;
      });
      return { success: true, output: results };
    } catch (e) {
      return {
        success: false,
        error: `Failed to search files: ${(e as Error).message}`,
      };
    }
  }

  searchFile({
    query,
    path: p = '.',
    caseSensitive = false,
    maxResults = 50,
  }: any): ToolResult {
    if (!query || typeof query !== 'string') {
      return { success: false, error: 'Missing query' };
    }
    const base = this.resolve(p);
    const needle = caseSensitive ? query : query.toLowerCase();
    const results: string[] = [];
    const max = Number.isFinite(maxResults)
      ? Math.max(1, Math.floor(maxResults))
      : 50;

    try {
      this.walkFiles(base, (filePath) => {
        if (results.length >= max) return false;
        const name = path.basename(filePath);
        const hay = caseSensitive ? name : name.toLowerCase();
        if (hay.includes(needle)) {
          results.push(
            path.relative(this.repoContext.get().codePath, filePath),
          );
          if (results.length >= max) return false;
        }
        return true;
      });
      return { success: true, output: results };
    } catch (e) {
      return {
        success: false,
        error: `Failed to search file names: ${(e as Error).message}`,
      };
    }
  }

  insert({ path: p, content, after, before }: any): ToolResult {
    const full = this.resolve(p);
    if (typeof content !== 'string') {
      return { success: false, error: 'Missing content' };
    }
    if (
      (typeof after === 'string' && typeof before === 'string') ||
      (typeof after !== 'string' && typeof before !== 'string')
    ) {
      return {
        success: false,
        error: 'Provide exactly one of after or before',
      };
    }
    const anchor = typeof after === 'string' ? after : before;
    if (!anchor) {
      return { success: false, error: 'Missing anchor text' };
    }
    try {
      const original = fs.readFileSync(full, 'utf-8');
      const index = original.indexOf(anchor);
      if (index < 0) {
        return { success: false, error: 'Anchor text not found' };
      }
      const insertAt =
        typeof after === 'string' ? index + anchor.length : index;
      const updated = `${original.slice(0, insertAt)}${content}${original.slice(insertAt)}`;
      fs.writeFileSync(full, updated, 'utf-8');
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: `Failed to insert in file: ${(e as Error).message}`,
      };
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
