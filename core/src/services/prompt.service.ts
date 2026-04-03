import { Injectable } from '@nestjs/common';
import { Task } from '../types';
import { PromptTemplateService } from './prompt-template.service';
import { BuildResult } from '../types';
import { AIInstructionsService } from './ai-instructions.service';
import { PromptBuilders } from '../helpers/prompt-builders';
import { ContextFileService } from './context-file.service';
import { RunLoggerService } from './run-logger.service';

@Injectable()
export class PromptService {
  constructor(
    private readonly templates: PromptTemplateService,
    private readonly contextFiles: ContextFileService,
    private readonly instructions: AIInstructionsService,
    private readonly logger: RunLoggerService,
  ) {}

  async buildTaskExecutionMessages(task: Task): Promise<Array<{ role: string; content: string }>> {
    const contextBundle = this.contextFiles.getContextBundle(task);
    this.logger.taskContextPolicy(task, { phase: 'execution', policy: contextBundle.policy });
    const instructionText = this.instructions.getInstructions(task);
    const system = PromptBuilders.buildSystem(contextBundle.context, instructionText, contextBundle.policy);
    const user = this.templates.render('task-execution', { task, contextPolicy: contextBundle.policy });

    return PromptBuilders.buildTaskExecutionMessages(system, user);
  }

  async buildTaskRetryMessages(task: Task, buildRes: BuildResult): Promise<Array<{ role: string; content: string }>> {
    const contextBundle = this.contextFiles.getContextBundle(task);
    this.logger.taskContextPolicy(task, { phase: 'retry', policy: contextBundle.policy });
    const instructionText = this.instructions.getInstructions(task);
    const system = PromptBuilders.buildSystem(contextBundle.context, instructionText, contextBundle.policy);
    const error = PromptBuilders.buildRetryErrorText(buildRes.stderr, buildRes.stdout);
    const user = this.templates.render('task-retry', { task, result: task.result, error, contextPolicy: contextBundle.policy });

    return PromptBuilders.buildTaskRetryMessages(system, user);
  }
}
