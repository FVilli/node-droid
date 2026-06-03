import { Injectable } from '@nestjs/common';
import { Task, TaskBlock, TaskOutcome } from '../types';

@Injectable()
export class TaskQueueService {
  private tasks: Task[] = [];
  private blocks: TaskBlock[] = [];
  private index = 0;

  load(tasks: Task[]): void {
    this.loadBlocks([
      { id: 'block-1', title: 'All tasks', targetDir: '.', tasks },
    ]);
  }

  loadBlocks(blocks: TaskBlock[]): void {
    this.blocks = blocks;
    this.tasks = blocks.flatMap((block) => block.tasks);
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
    const task = this.tasks.find((item) => item.id === taskId);
    if (!task) return;
    task.status = status;
  }

  list(): Task[] {
    return this.tasks;
  }

  listBlocks(): TaskBlock[] {
    return this.blocks;
  }

  hasPending(): boolean {
    return this.index < this.tasks.length;
  }
}
