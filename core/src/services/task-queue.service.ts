import { Injectable } from '@nestjs/common';
import { Task } from '../interfaces';
import { TaskStatus } from '../types';

@Injectable()
export class TaskQueueService {
  private tasks: Task[] = [];

  set(tasks: Task[]) { this.tasks = tasks; }

  hasNext() { return this.tasks.some(t => t.status === 'PENDING'); }

  next(): Task | null {
    const t = this.tasks.find(t => t.status === 'PENDING');
    if (!t) return null;
    t.status = 'IN_PROGRESS';
    return t;
  }

  markDone(id: string) { const t = this.find(id); if (t) t.status = 'DONE'; }
  markFailed(id: string) { const t = this.find(id); if (t) t.status = 'FAILED'; }
  incAttempt(id: string) { const t = this.find(id); if (t) t.attempts++; }

  all() { return this.tasks; }

  private find(id: string) { return this.tasks.find(t => t.id === id); }
}
