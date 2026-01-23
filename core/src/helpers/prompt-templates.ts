import { ENV } from '../env';

export class PromptTemplates {
  static render(name: string, params: any): string {
    switch (name) {
      case 'task-extraction':
        return `Extract tasks from:\n${params.content}`;
      case 'task-execution':
        return this.renderTaskExecution(params.task);
      case 'task-retry':
        return [
          'The task was executed, but the build failed.',
          'Task:',
          JSON.stringify(params.task, null, 2),
          'What was done:',
          params.result || 'No summary provided.',
          'Build error:',
          params.error
        ].join('\n');
      default:
        throw new Error(`Unknown template: ${name}`);
    }
  }

  private static renderTaskExecution(task: any): string {
    const title = task?.title || '';
    const description = task?.description || '';
    const file = task?.file || '';
    const isMdTask = task?.source === 'md' || (file && file.endsWith(ENV.AI_TODO_FILE));
    const lines: string[] = [];
    lines.push('Execute this task:');
    lines.push('<task>');
    lines.push(`### ${title}`);
    if (description) lines.push(description);
    lines.push('</task>');
    lines.push(`This task is defined in: <file>${file}</file>`);
    if (isMdTask) {
      lines.push(`Consider the folder of <file>${file}</file> as working directory of this task`);
    } else {
      lines.push('Consider this file as target of this task.');
    }
    return lines.join('\n');
  }
}
