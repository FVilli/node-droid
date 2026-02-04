import * as fs from 'fs';
import { nanoid } from 'nanoid';
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
export const toLocalIso = (date: Date = new Date(), timeZone = process.env.TZ) => {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const dtf = new Intl.DateTimeFormat('it-IT', {
    timeZone: timeZone || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset'
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const yyyy = get('year');
  const mm = get('month');
  const dd = get('day');
  const hh = get('hour');
  const min = get('minute');
  const ss = get('second');
  const ms = pad(date.getMilliseconds(), 3);
  const offsetRaw = get('timeZoneName') || 'GMT+0';
  const match = offsetRaw.match(/GMT([+-]?)(\d{1,2})(?::(\d{2}))?/);
  const sign = match?.[1] === '-' ? '-' : '+';
  const oh = pad(parseInt(match?.[2] || '0', 10));
  const om = pad(parseInt(match?.[3] || '0', 10));
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}.${ms}${sign}${oh}:${om}`;
};
export const extractTag = (s: string, tag: string) => (s.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)) || [])[1]?.trim();
export const splitPipe = (s?: string) => s ? s.split('|').map(x => x.trim()).filter(Boolean) : [];
export const hasTriggerCommit = (commits: string[], prefix = '[ai]') => commits.some(c => c.includes(prefix));
export const getRunId = () => nanoid(6);
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

export const formatTimeColonDot = (date: Date = new Date()) => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}.${ss}`;
};
