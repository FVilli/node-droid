import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Task } from '../types';

@Injectable()
export class TaskNormalizationService {
  normalize(tasks: Task[]): Task[] {
    const unique = new Map<string, Task>();

    for (const task of tasks) {
      const normalized = this.normalizeTask(task);
      const dedupeKey = this.getDedupeKey(normalized);
      if (!unique.has(dedupeKey)) {
        unique.set(dedupeKey, normalized);
      }
    }

    return Array.from(unique.values()).sort((a, b) => {
      const fileCompare = (a.file || '').localeCompare(b.file || '');
      if (fileCompare !== 0) return fileCompare;

      const lineCompare = (a.line || 0) - (b.line || 0);
      if (lineCompare !== 0) return lineCompare;

      return a.title.localeCompare(b.title);
    });
  }

  private normalizeTask(task: Task): Task {
    const title = this.clean(task.title);
    const description = this.clean(task.description);
    const source = task.source || 'unknown';
    const normalized: Task = {
      ...task,
      id: this.buildId(task, title, description, source),
      title,
      description,
      source,
      file: task.file?.trim(),
      relatedFiles: this.normalizeRelatedFiles(task.relatedFiles),
      status: task.status || 'TODO',
    };

    return normalized;
  }

  private normalizeRelatedFiles(relatedFiles?: string[]): string[] | undefined {
    if (!relatedFiles?.length) return relatedFiles;
    return Array.from(new Set(relatedFiles.map(file => file.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  private buildId(task: Task, title: string, description: string, source: string): string {
    const payload = [
      source,
      task.file?.trim() || '',
      String(task.line || 0),
      title,
      description,
    ].join('|');

    return createHash('sha1').update(payload).digest('hex').slice(0, 12);
  }

  private getDedupeKey(task: Task): string {
    return [
      task.source,
      task.file || '',
      String(task.line || 0),
      task.title,
      task.description,
    ].join('|');
  }

  private clean(value?: string): string {
    return (value || '').replace(/\s+/g, ' ').trim();
  }
}
