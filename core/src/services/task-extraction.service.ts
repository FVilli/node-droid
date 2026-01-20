import { Injectable } from '@nestjs/common';
import { Task } from '../interfaces';
import { ENV } from '../env';

@Injectable()
export class TaskExtractionService {

  async extractFromFile(file: string, content: string): Promise<Task[]> {
    if (file.endsWith('.ts')) return this.fromTS(file, content);
    if (file.endsWith(ENV.AI_TODO_FILE)) return this.fromMD(file, content);
    return [];
  }

  private fromTS(file: string, content: string): Task[] {
    const tasks: Task[] = [];
    const lines = content.split('\n');
    const tag = ENV.AI_TODO_COMMENT;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // // ai: ...
      if (line.startsWith('//') && line.includes(tag)) {
        const body = line.split(tag)[1]?.trim();
        if (!body) continue;
        const [title, ...rest] = body.split('|').map(s => s.trim());
        tasks.push({ source: 'ts', file, line: i + 1, title, description: rest.join(' | ') || '' });
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

  private parseBlock(block: string, file: string, line: number): Task[] {
    const out: Task[] = [];
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    // Lista
    if (lines.some(l => l.startsWith('-'))) {
      for (const l of lines) {
        if (!l.startsWith('-')) continue;
        const body = l.replace(/^-/, '').trim();
        const [title, ...rest] = body.split('|').map(s => s.trim());
        out.push({ source: 'ts', file, line, title, description: rest.join(' | ') || '' });
      }
      return out;
    }

    // Testo libero
    const [first, ...rest] = lines;
    const [title, ...descInline] = first.split('|').map(s => s.trim());
    const desc = [...descInline, ...rest].join('\n').trim();

    out.push({ source: 'ts', file, line, title, description: desc || '' });
    return out;
  }

  private fromMD(file: string, content: string): Task[] {
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
          source: 'md',
          file,
          line: i + 1,
          title,
          description: rest.join(' | ') || ''
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
}
