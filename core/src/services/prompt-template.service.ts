import { Injectable } from '@nestjs/common';

@Injectable()
export class PromptTemplateService {

  render(name: string, params: any): string {
    switch (name) {
      case 'task-extraction': return `Extract tasks from:\n${params.content}`;
      case 'task-execution': return `Execute task:\n${JSON.stringify(params.task, null, 2)}`;
      case 'task-retry': return `Fix error:\n${params.error}`;
      default: throw new Error(`Unknown template: ${name}`);
    }
  }
}
