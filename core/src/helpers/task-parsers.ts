import { Task } from '../types';
import { ENV } from '../env';
import { nanoid } from 'nanoid';
import * as path from 'path';

export class TaskParsers {
  static fromTS(file: string, content: string): Task[] {
    const tasks: Task[] = [];
    const lines = content.split('\n');
    const tag = ENV.AI_TODO_COMMENT;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // // ai: ...
      if (line.startsWith('//') && line.includes(tag)) {
        const body = line.split(tag)[1]?.trim();
        if (!body) continue;
        const title = body;
        const descLines: string[] = [];
        let j = i + 1;
        while (j < lines.length && lines[j].trim().startsWith('//') && !lines[j].includes(tag)) {
          const desc = lines[j].replace(/^(\s*\/\/)\s?/, '').trim();
          if (desc) descLines.push(desc);
          j++;
        }
        const codeSnippet = this.captureAdjacentCode(lines, j);
        const extraDesc = descLines.length ? descLines.join('\n') : '';
        
        tasks.push({
          id: nanoid(4),
          source: 'ts',
          file,
          line: i + 1,
          title,
          description: extraDesc,
          codeSnippet,
          relatedFiles: [file],
          status: 'TODO',
        });
        i = j - 1;
      }

      // /* ai: ... */
      if (line.startsWith('/*') && line.includes(tag)) {
        let block = line.split(tag)[1]?.trim() || '';
        let j = i + 1;

        while (j < lines.length && !lines[j].includes('*/')) {
          block += '\n' + lines[j];
          j++;
        }

        const blockTasks = this.parseBlock(block, file, i + 1);
        tasks.push(...blockTasks);
        i = j;
      }
    }

    return tasks;
  }

  static fromMD(file: string, content: string): Task[] {
    const tasks: Task[] = [];
    const lines = content.split('\n');

    let current: Task | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const bullet = line.match(/^- (.+)$/);
      if (bullet) {
        if (current) tasks.push(current);

        const body = bullet[1].trim();
        const [title, ...rest] = body.split('|').map(s => s.trim());

        current = {
          id: nanoid(4),
          source: 'md',
          file,
          line: i + 1,
          title,
          description: rest.join(' | ') || '',
          relatedFiles: this.getRelatedFilesForMD(file),
          status: 'TODO',
        };
        continue;
      }

      // Descrizione multilinea (indentata)
      if (current && (line.startsWith(' ') || line.startsWith('\t'))) {
        const d = line.trim();
        if (d) {
          current.description += ' ' + d;
          current.description = current.description.trim();
        }
        continue;
      }

      if (!line.trim() && current) {
        tasks.push(current);
        current = null;
      }
    }

    if (current) tasks.push(current);
    return tasks;
  }

  private static parseBlock(block: string, file: string, line: number): Task[] {
    const out: Task[] = [];
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    // Lista
    if (lines.some(l => l.startsWith('-'))) {
      for (const l of lines) {
        if (!l.startsWith('-')) continue;
        const body = l.replace(/^-/, '').trim();
        out.push({
          id: nanoid(4),
          source: 'ts',
          file,
          line,
          title: body,
          description: '',
          relatedFiles: [file],
          status: 'TODO',
        });
      }
      return out;
    }

    // Testo libero
    const [first, ...rest] = lines;
    const title = first;
    const desc = rest.join('\n').trim();

    out.push({
      id: nanoid(4),
      source: 'ts',
      file,
      line,
      title,
      description: desc || '',
      relatedFiles: [file],
      status: 'TODO',
    });
    return out;
  }

  private static captureAdjacentCode(lines: string[], startIndex: number): string {
    let k = startIndex;
    while (k < lines.length && !lines[k].trim()) k++;
    if (k >= lines.length) return '';
    const firstLine = lines[k];
    const firstTrim = firstLine.trim();
    if (firstTrim.startsWith('//') || firstTrim.startsWith('/*') || firstTrim.startsWith('*') || firstTrim.startsWith('{') || firstTrim.startsWith('}')) return '';
    const snippet: string[] = [firstLine];
    if (firstTrim.startsWith('@')) {
      let next = k + 1;
      while (next < lines.length && !lines[next].trim()) next++;
      if (next < lines.length) snippet.push(lines[next]);
    }
    return ['```ts', snippet.join('\n'), '```'].join('\n');
  }

  private static getRelatedFilesForMD(file: string): string[] {
    const dir = path.dirname(file);
    const prefix = dir === '.' ? '' : `${dir}/`;
    return [
      `${prefix}*.ts`,
      `${prefix}*.js`,
      `${prefix}*.tsx`,
      `${prefix}*.jsx`,
      `${prefix}*.json`,
      `${prefix}*.md`
    ];
  }
}
