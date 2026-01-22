export class PromptTemplates {
  static render(name: string, params: any): string {
    switch (name) {
      case 'task-extraction':
        return `Extract tasks from:\n${params.content}`;
      case 'task-execution':
        return `Execute task:\n${JSON.stringify(params.task, null, 2)}`;
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
}
