import * as fs from 'fs';
import * as path from 'path';
import { Task } from '../types';

export class AIInstructionsHelper {
  static getInstructions(codePath: string, task: Task): string | null {
    const rootPath = path.join(codePath, 'ai-instructions.md');
    const root = this.readIfExists(rootPath);

    const taskDir = task.file ? path.dirname(task.file) : null;
    const localPath = taskDir && taskDir !== '.'
      ? path.join(codePath, taskDir, 'ai-instructions.md')
      : null;
    const local = localPath && localPath !== rootPath ? this.readIfExists(localPath) : null;

    if (!root && !local) return null;

    const parts: string[] = [];
    if (root) {
      parts.push('## Project Instructions (root)');
      parts.push(root);
    }
    if (local) {
      parts.push(`## Directory Instructions (${taskDir})`);
      parts.push(local);
    }
    return parts.join('\n\n');
  }

  private static readIfExists(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      return content || null;
    } catch {
      return null;
    }
  }
}
