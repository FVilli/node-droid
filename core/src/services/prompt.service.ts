import { Injectable } from '@nestjs/common';
import { Task } from '../types';
import { PromptTemplateService } from './prompt-template.service';
import { BuildResult } from '../types';
import { AIInstructionsService } from './ai-instructions.service';
import { PromptBuilders } from '../helpers/prompt-builders';

@Injectable()
export class PromptService {
  constructor(
    private readonly templates: PromptTemplateService,
    private readonly instructions: AIInstructionsService,
  ) {}

  buildTaskAnalysisMessages(
    task: Task,
  ): Array<{ role: string; content: string }> {
    const instructionText = this.instructions.getInstructions(task);
    const system = PromptBuilders.buildAnalysisSystem(instructionText);
    const user = this.templates.render('task-analysis', { task });

    return PromptBuilders.buildTaskExecutionMessages(system, user);
  }

  buildTaskExecutionMessages(
    task: Task,
    analysis?: string,
  ): Array<{ role: string; content: string }> {
    const instructionText = this.instructions.getInstructions(task);
    const system = PromptBuilders.buildSystem(instructionText);
    const user = this.templates.render('task-execution', { task, analysis });

    return PromptBuilders.buildTaskExecutionMessages(system, user);
  }

  buildTaskRetryMessages(
    task: Task,
    buildRes: BuildResult,
  ): Array<{ role: string; content: string }> {
    const instructionText = this.instructions.getInstructions(task);
    const system = PromptBuilders.buildSystem(instructionText);
    const error = PromptBuilders.buildRetryErrorText(
      buildRes.stderr,
      buildRes.stdout,
    );
    const user = this.templates.render('task-retry', {
      task,
      result: task.result,
      error,
      analysis: task.analysis,
    });

    return PromptBuilders.buildTaskRetryMessages(system, user);
  }
}
