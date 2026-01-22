import { Task } from '../types';

export class PromptBuilders {
  static buildSystem(projectContext: string | null, instructions: string | null): string {
    const system = [
      'You are an expert software agent working inside a Node.js monorepo.',
      'Use the available tools to inspect and modify files when needed.',
      'When the task is complete, respond with a short summary of what was done.'
    ].join(' ');

    const blocks = [system];
    if (instructions) blocks.push(`\n## Project Instructions\n\n${instructions}`);
    if (projectContext) blocks.push(`\n## Project Context\n\n${projectContext}`);
    return blocks.join('');
  }

  static buildTaskExecutionMessages(system: string, user: string) {
    return [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];
  }

  static buildTaskRetryMessages(system: string, user: string) {
    return [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];
  }

  static buildRetryErrorText(stderr: string, stdout: string): string {
    return stderr || stdout || 'Build failed with no output.';
  }
}
