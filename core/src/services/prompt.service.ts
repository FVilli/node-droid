import { Injectable } from '@nestjs/common';
import { Task } from '../interfaces';
import { PromptTemplateService } from './prompt-template.service';
import { RepomixService } from './repomix.service';
import { BuildResult } from '../interfaces';
import { AIInstructionsService } from './ai-instructions.service';

@Injectable()
export class PromptService {
  constructor(
    private readonly templates: PromptTemplateService,
    private readonly repomix: RepomixService,
    private readonly instructions: AIInstructionsService,
  ) {}

  async buildTaskExecutionMessages(task: Task): Promise<Array<{ role: string; content: string }>> {
    const projectContext = await this.repomix.getSmartProjectContext(task);
    const instructionText = this.instructions.getInstructions(task);
    const system = this.buildSystem(projectContext, instructionText);
    const user = this.templates.render('task-execution', { task });

    return [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];
  }

  async buildTaskRetryMessages(task: Task, buildRes: BuildResult): Promise<Array<{ role: string; content: string }>> {
    const projectContext = await this.repomix.getSmartProjectContext(task);
    const instructionText = this.instructions.getInstructions(task);
    const system = this.buildSystem(projectContext, instructionText);
    const error = buildRes.stderr || buildRes.stdout || 'Build failed with no output.';
    const user = this.templates.render('task-retry', { task, result: task.result, error });

    return [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];
  }

  private buildSystem(projectContext: string | null, instructions: string | null): string {
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
}
