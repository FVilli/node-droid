import { Injectable } from '@nestjs/common';
import { Task } from '../types';
import { PromptTemplateService } from './prompt-template.service';
import { RepomixService } from './repomix.service';
import { BuildResult } from '../types';
import { AIInstructionsService } from './ai-instructions.service';
import { PromptBuilders } from '../helpers/prompt-builders';

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
    const system = PromptBuilders.buildSystem(projectContext, instructionText);
    const user = this.templates.render('task-execution', { task });

    return PromptBuilders.buildTaskExecutionMessages(system, user);
  }

  async buildTaskRetryMessages(task: Task, buildRes: BuildResult): Promise<Array<{ role: string; content: string }>> {
    const projectContext = await this.repomix.getSmartProjectContext(task);
    const instructionText = this.instructions.getInstructions(task);
    const system = PromptBuilders.buildSystem(projectContext, instructionText);
    const error = PromptBuilders.buildRetryErrorText(buildRes.stderr, buildRes.stdout);
    const user = this.templates.render('task-retry', { task, result: task.result, error });

    return PromptBuilders.buildTaskRetryMessages(system, user);
  }
}
