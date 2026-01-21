import * as fs from 'fs';
import * as path from 'path';

export const readRepoFileSafe = (repoPath: string, file: string) => {
  try {
    const full = path.resolve(repoPath, file);
    if (!full.startsWith(path.resolve(repoPath))) return null; // path escape guard
    const rv = fs.readFileSync(full, 'utf-8');
    console.log("=".repeat(100));
    console.log(file);
    console.log("=".repeat(100));
    console.log(rv);
    console.log("=".repeat(100));
    return rv;
  } catch {
    return null;
  }
};

export const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
export const extractTag = (s: string, tag: string) => (s.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)) || [])[1]?.trim();
export const splitPipe = (s?: string) => s ? s.split('|').map(x => x.trim()).filter(Boolean) : [];
export const hasTriggerCommit = (commits: string[], prefix = '[ai]') => commits.some(c => c.includes(prefix));
export const getRunId = () => Math.trunc(Date.now()/60000).toString();
export const normalizeGitFiles = (files: string[]) => {
  // ['A\tsrc/file-due.ts','A\tsrc/file1.ts','M\tsrc/file1.ts','D\tsrc/file1.ts']
  // TODO: da un array con quella formattazione, restituire un array con i file finali (senza duplicati e senza quelli rimossi)
  const fileMap: Record<string, 'A' | 'M' | 'D'> = {};
  for (const entry of files) {
    const match = entry.match(/^([AMD])\s+(.+)$/);
    if (!match) continue;
    const [, status, filePath] = match;
    if (status === 'D') {
      delete fileMap[filePath];
    } else {
      fileMap[filePath] = status as 'A' | 'M';
    }
  }
  return Object.keys(fileMap);
};
export const normalizeCommits = (commits: string[]) => {
  // ['abc123 Fix issue', 'def456 Add feature', 'abc123 Fix issue']
  const seen = new Set<string>();
  const result: string[] = [];
  for (const commit of commits) {
    const hash = commit.split(' ')[0];
    const commitMessage = commit.substring(hash.length).trim();
    if (!seen.has(hash)) {
      seen.add(hash);
      result.push(commitMessage);
    }
  }
  return result;
};
