import { Injectable } from '@nestjs/common';
import { Task } from '../types';
import { ENV } from '../env';
import { TaskParsers } from '../helpers/task-parsers';

@Injectable()
export class TaskExtractionService {

  async extractFromFile(file: string, content: string): Promise<Task[]> {
    if (file.endsWith('.ts')) return TaskParsers.fromTS(file, content);
    if (file.endsWith(ENV.AI_TODO_FILE)) return TaskParsers.fromMD(file, content);
    return [];
  }
}
