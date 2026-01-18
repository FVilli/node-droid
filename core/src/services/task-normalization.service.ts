import { Injectable } from '@nestjs/common';
import { RawTask, Task } from '../interfaces';
import { TaskStatus } from '../types';

@Injectable()
export class TaskNormalizationService {

  normalize(raw: RawTask[]): Task[] {
    return raw.map((t, i) => this.normalizeOne(t, i));
  }

  private normalizeOne(t: RawTask, idx: number): Task {
    return {
      id: this.generateId(t, idx),
      title: t.title,
      description: t.description,
      source: t.source,
      status: 'PENDING',
      file: t.file,
      line: t.line,
      relatedFiles: [],
      attempts: 0,
    };
  }

  private generateId(t: RawTask, idx: number) { return `${t.source}-${idx}-${t.title.replace(/\s+/g, '_').toLowerCase()}`; }
}
