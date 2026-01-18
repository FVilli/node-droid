import * as fs from 'fs';
import * as path from 'path';

export const readRepoFileSafe = (repoPath: string, file: string) => {
  try {
    const full = path.resolve(repoPath, file);
    if (!full.startsWith(path.resolve(repoPath))) return null; // path escape guard
    return fs.readFileSync(full, 'utf-8');
  } catch {
    return null;
  }
};

export const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export const extractTag = (s: string, tag: string) =>
  (s.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)) || [])[1]?.trim();

export const splitPipe = (s?: string) => s ? s.split('|').map(x => x.trim()).filter(Boolean) : [];

export const hasTriggerCommit = (commits: string[], prefix = '[ai]') =>
  commits.some(c => c.includes(prefix));

export const extractFilePaths = (files: string[]) =>
  files.map(f => f.replace(/^[AMD]\s+/, '').trim());
