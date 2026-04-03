import { Injectable } from '@nestjs/common';
import { Task, TaskOutcome } from '../types';

@Injectable()
export class TaskQueueService {
  private tasks: Task[] = [];
  private index = 0;

  load(tasks: Task[]): void {
    this.tasks = tasks;
    this.index = 0;
  }

  next(): { task: Task; index: number } | null {
    if (this.index >= this.tasks.length) return null;
    const currentIndex = this.index;
    const task = this.tasks[currentIndex];
    this.index++;
    return { task, index: currentIndex };
  }

  mark(taskId: string, status: TaskOutcome): void {
    const task = this.tasks.find(item => item.id === taskId);
    if (!task) return;
    task.status = status;
  }

  list(): Task[] {
    return this.tasks;
  }

  hasPending(): boolean {
    return this.index < this.tasks.length;
  }
}
