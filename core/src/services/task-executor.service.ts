import { Injectable } from '@nestjs/common';
import { Task } from '../interfaces';
import { LLMClientService } from './llm-client.service';
import { ToolRegistryService } from './tool-registry.service';
import { BuildService } from './build.service';
import { RunLoggerService } from './run-logger.service';
import { RunStateService } from './run-state.service';
import { PromptService } from './prompt.service';
import { LLMProfileResolverService } from './llm-profile-resolver.service';
import { RepoContextService } from './repo-context.service';
import { TaskOutcome } from '../types';
import { ENV } from 'src/env';
import { BuildResult } from '../interfaces';

@Injectable()
export class TaskExecutorService {

  constructor(
    private readonly llm: LLMClientService,
    private readonly tools: ToolRegistryService,
    private readonly build: BuildService,
    private readonly logger: RunLoggerService,
    private readonly runState: RunStateService,
    private readonly prompt: PromptService,
    private readonly llmProfileResolver: LLMProfileResolverService,
    private readonly repoContext: RepoContextService,
  ) {}

  async execute(task: Task): Promise<TaskOutcome> {
    this.runState.setCurrentTask(task.title);

    if (ENV.NO_LLM) {
      this.logger.info(`[DRY] Would execute task: ${task.title}`);
      return 'DONE';
    }

    this.logger.taskStart(task);

    const maxRetries = this.repoContext.get().agentPolicy.maxTaskRetries ?? ENV.MAX_TASK_RETRIES;

    let completed = false;
    for (let i = 0; i < maxRetries; i++) {
      if (this.runState.isShuttingDown()) {
        this.logger.warn(`Task [${task.title}] interrupted before attempt ${i + 1}`);
        return 'INTERRUPTED';
      }

      this.runState.incAttempt();
      this.logger.taskAttempt(task, i + 1);

      const ok = await this.runOnce(task);
      if (ok) { completed = true; break; }
    }

    if (!completed) {
      this.logger.taskFailed(task);
      return 'FAILED';
    }

    if (this.runState.isShuttingDown()) {
      this.logger.warn(`Task [${task.title}] interrupted after execution step`);
      return 'INTERRUPTED';
    }

    const buildRes = await this.build.run(ENV.BUILD_CMD);
    this.logger.taskBuildResult(task, { phase: 'initial', result: buildRes });
    if (buildRes.success) { this.logger.taskDone(task); return 'DONE'; }

    if (this.runState.isShuttingDown()) {
      this.logger.warn(`Task [${task.title}] interrupted before retry`);
      return 'INTERRUPTED';
    }

    this.runState.resetAttempt();
    for (let i = 0; i < maxRetries; i++) {
      if (this.runState.isShuttingDown()) {
        this.logger.warn(`Task [${task.title}] interrupted before retry ${i + 1}`);
        return 'INTERRUPTED';
      }

      this.runState.incAttempt();
      this.logger.taskAttemptFix(task, i + 1);

      const fixed = await this.runOnceAfterBuildFailure(task, buildRes);
      if (!fixed) continue;

      const retryBuild = await this.build.run(ENV.BUILD_CMD);
      this.logger.taskBuildResult(task, { phase: 'retry', result: retryBuild });
      if (retryBuild.success) { this.logger.taskDone(task); return 'DONE'; }
    }

    this.logger.taskFailed(task);
    return 'FAILED';
  }

  private async runOnce(task: Task): Promise<boolean> {
    const messages = await this.prompt.buildTaskExecutionMessages(task);
    return this.runLLMLoop(task, messages);
  }

  private async runOnceAfterBuildFailure(task: Task, buildRes: BuildResult): Promise<boolean> {
    if (this.runState.isShuttingDown()) return false;
    this.logger.warn(`Notifying LLM about failure for [${task.title}]`);
    const messages = await this.prompt.buildTaskRetryMessages(task, buildRes);
    return this.runLLMLoop(task, messages);
  }

  private async runLLMLoop(task: Task, messages: any[]): Promise<boolean> {
    // IMPORTANTE: qui NON controlliamo shutdown a metà di un’operazione atomica
    const profile = this.llmProfileResolver.resolve(this.repoContext.get());
    const tools = this.tools.getTools();
    const maxToolCalls = this.repoContext.get().agentPolicy.maxToolCallsPerTask ?? ENV.MAX_TOOL_CALLS_PER_TASK;
    let toolCallsCount = 0;

    while (toolCallsCount <= maxToolCalls) {
      const promptSnapshot = messages.map(m => ({ ...m }));
      const llmStart = Date.now();
      const response = await this.llm.chat(messages, profile, tools);
      const llmDuration = Date.now() - llmStart;
      const message = response?.choices?.[0]?.message;

      if (!message) {
        task.result = 'No response from LLM';
        return false;
      }

      this.logger.taskLLMCall(task, {
        messages: promptSnapshot,
        response: { role: message.role, content: message.content, tool_calls: message.tool_calls },
        durationMs: llmDuration
      });

      messages.push({
        role: message.role || 'assistant',
        content: message.content || null,
        tool_calls: message.tool_calls || undefined
      });

      const toolCalls = message.tool_calls || [];
      if (!toolCalls.length) {
        task.result = message.content || '';
        return true;
      }

      for (const call of toolCalls) {
        toolCallsCount++;
        if (toolCallsCount > maxToolCalls) {
          task.result = 'Max tool calls reached';
          return false;
        }

        const name = call.function?.name;
        if (!name) {
          task.result = 'Tool call without name';
          return false;
        }

        let args: Record<string, any> = {};
        try {
          args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch (err) {
          args = {};
        }

        const toolStart = Date.now();
        const result = await this.tools.execute({ name, arguments: args });
        const toolDuration = Date.now() - toolStart;
        this.logger.taskToolCall(task, { name, args, result, durationMs: toolDuration });

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result)
        });
      }
    }

    task.result = 'Max tool calls reached';
    return false;
  }
}
