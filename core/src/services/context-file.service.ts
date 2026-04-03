import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { RepoContextService } from './repo-context.service';
import { Task } from '../types';
import { ENV } from '../env';

export interface ContextPolicy {
  targetDir: string;
  hasRootContext: boolean;
  hasTargetContext: boolean;
  shouldBootstrap: boolean;
  allowRefresh: boolean;
}

@Injectable()
export class ContextFileService {
  constructor(private readonly repoContext: RepoContextService) {}

  getContextBundle(task: Task): { context: string | null; policy: ContextPolicy } {
    const { codePath } = this.repoContext.get();
    const relDir = task.file ? path.dirname(task.file) : '.';
    const dirs = this.getRelevantDirs(relDir);
    const parts: string[] = [];
    let hasRootContext = false;
    let hasTargetContext = false;

    for (const dir of dirs) {
      const ctxPath = dir === '.'
        ? path.join(codePath, ENV.AI_CONTEXT_FILE)
        : path.join(codePath, dir, ENV.AI_CONTEXT_FILE);
      const content = this.readIfExists(ctxPath);
      if (!content) continue;
      const label = dir === '.' ? 'root' : dir;
      if (dir === '.') hasRootContext = true;
      if (dir === relDir || (relDir === '.' && dir === '.')) hasTargetContext = true;
      parts.push(`## ${ENV.AI_CONTEXT_FILE} (${label})`);
      parts.push(content);
    }

    const targetDir = relDir && relDir !== '' ? relDir : '.';
    const shouldBootstrap = targetDir === '.' ? !hasRootContext : !hasTargetContext;
    const policy: ContextPolicy = {
      targetDir,
      hasRootContext,
      hasTargetContext,
      shouldBootstrap,
      allowRefresh: hasRootContext || hasTargetContext || shouldBootstrap,
    };

    return {
      context: parts.length ? parts.join('\n\n') : null,
      policy,
    };
  }

  private getRelevantDirs(relDir: string): string[] {
    const normalized = relDir && relDir !== '' ? relDir : '.';
    if (normalized === '.' || normalized === path.sep) return ['.'];

    const segments = normalized.split('/').filter(Boolean);
    const dirs = ['.'];
    for (let i = 0; i < segments.length; i++) {
      dirs.push(segments.slice(0, i + 1).join('/'));
    }
    return dirs;
  }

  private readIfExists(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      return content || null;
    } catch {
      return null;
    }
  }
}
