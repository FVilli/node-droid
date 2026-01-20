import { Injectable } from '@nestjs/common';
import { Task } from '../interfaces';
import { LLMClientService } from './llm-client.service';
import { ToolRegistryService } from './tool-registry.service';
import { BuildService } from './build.service';
import { RunLoggerService } from './run-logger.service';
import { RunStateService } from './run-state.service';
import { TaskOutcome } from '../types';
import { ENV } from 'src/env';

@Injectable()
export class TaskExecutorService {

  constructor(
    private readonly llm: LLMClientService,
    private readonly tools: ToolRegistryService,
    private readonly build: BuildService,
    private readonly logger: RunLoggerService,
    private readonly runState: RunStateService,
  ) {}

  async execute(task: Task): Promise<TaskOutcome> {
    return 'DONE';
    
    this.runState.setCurrentTask(task.title);

    if (ENV.NO_LLM) {
      this.logger.info(`[DRY] Would execute task: ${task.title}`);
      return 'DONE';
    }

    this.logger.taskStart(task);

    const maxRetries = 3; // TODO: da policy

    for (let i = 0; i < maxRetries; i++) {
      if (this.runState.isShuttingDown()) {
        this.logger.warn(`Task [${task.title}] interrupted before attempt ${i + 1}`);
        return 'INTERRUPTED';
      }

      this.runState.incAttempt();
      this.logger.taskAttempt(task.title, i + 1);

      const ok = await this.runOnce(task);
      if (ok) { this.logger.taskDone(task.title); return 'DONE'; }

      if (this.runState.isShuttingDown()) {
        this.logger.warn(`Task [${task.title}] interrupted after execution step`);
        return 'INTERRUPTED';
      }

      const buildRes = await this.build.run(ENV.BUILD_CMD);
      if (buildRes.success) { this.logger.taskDone(task.title); return 'DONE'; }

      this.logger.taskBuildFailed(task.title, buildRes);

      if (this.runState.isShuttingDown()) {
        this.logger.warn(`Task [${task.title}] interrupted before retry`);
        return 'INTERRUPTED';
      }

      await this.notifyLLMFailure(task, buildRes);
    }

    this.logger.taskFailed(task.title);
    return 'FAILED';
  }

  private async runOnce(task: Task): Promise<boolean> {
    // TODO: loop LLM + tool calls (operazioni atomiche)
    // IMPORTANTE: qui NON controlliamo shutdown a metà di un’operazione atomica
    return false;
  }

  private async notifyLLMFailure(task: Task, err: any) {
    if (this.runState.isShuttingDown()) return;
    this.logger.warn(`Notifying LLM about failure for [${task.title}]`);
    // TODO: invio contesto errore all’LLM
  }
}
