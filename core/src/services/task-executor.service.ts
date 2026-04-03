import { Injectable } from '@nestjs/common';
import { Task } from '../types';
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
import { BuildResult } from '../types';
import { BuildHelpers } from '../helpers/build-helpers';
import { LLMRunner } from '../helpers/llm-runner';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TaskExecutorService {

  constructor(
    private readonly llm: LLMClientService,
    private readonly tools: ToolRegistryService,
    private readonly scripts: BuildService,
    private readonly logger: RunLoggerService,
    private readonly runState: RunStateService,
    private readonly prompt: PromptService,
    private readonly llmProfileResolver: LLMProfileResolverService,
    private readonly repoContext: RepoContextService,
  ) {}

  async execute(task: Task): Promise<TaskOutcome> {
    this.runState.setCurrentTask({
      id: task.id,
      title: task.title,
      index: this.runState.getCurrentTask()?.index,
      status: task.status,
    });

    if (ENV.NO_LLM) {
      this.logger.info(`[DRY] Would execute task: ${task.title}`);
      this.runState.setCurrentTaskStatus('DONE');
      return 'DONE';
    }

    this.logger.taskStart(task);

    const maxRetries = this.repoContext.get().agentPolicy.maxTaskRetries ?? ENV.MAX_TASK_RETRIES;

    let completed = false;
    for (let i = 0; i < maxRetries; i++) {
      if (this.runState.isShuttingDown()) {
        this.logger.warn(`Task [${task.title}] interrupted before attempt ${i + 1}`);
        this.runState.setCurrentTaskStatus('INTERRUPTED');
        return 'INTERRUPTED';
      }

      this.runState.incAttempt();
      this.logger.taskAttempt(task, i + 1);

      const ok = await this.runOnce(task);
      if (ok) {
        const blocker = this.extractBlocker(task.result);
        if (blocker) {
          task.blocker = blocker;
          task.result = blocker.message;
          this.logger.taskBlocked(task);
          this.runState.setCurrentTaskStatus('BLOCKED');
          return 'BLOCKED';
        }
        completed = true;
        break;
      }
    }

    if (!completed) {
      this.logger.taskFailed(task);
      this.runState.setCurrentTaskStatus('FAILED');
      return 'FAILED';
    }

    if (this.runState.isShuttingDown()) {
      this.logger.warn(`Task [${task.title}] interrupted after execution step`);
      this.runState.setCurrentTaskStatus('INTERRUPTED');
      return 'INTERRUPTED';
    }

    const buildRes = await this.buildForTask(task);
    this.logger.taskBuildResult(task, { phase: 'initial', result: buildRes });
    if (buildRes.success) {
      this.logger.taskDone(task);
      this.runState.setCurrentTaskStatus('DONE');
      return 'DONE';
    }

    if (this.runState.isShuttingDown()) {
      this.logger.warn(`Task [${task.title}] interrupted before retry`);
      this.runState.setCurrentTaskStatus('INTERRUPTED');
      return 'INTERRUPTED';
    }

    const missing = BuildHelpers.extractMissingPackage(`${buildRes.stderr}\n${buildRes.stdout}`);
    if (missing) {
      task.blocker = {
        type: 'missing_dependency',
        packageName: missing,
        message: `Missing dependency: ${missing}. Please install it and retry the task.`,
      };
      task.result = task.blocker.message;
      this.logger.taskBlocked(task);
      this.runState.setCurrentTaskStatus('BLOCKED');
      return 'BLOCKED';
    }

    this.runState.resetAttempt();
    for (let i = 0; i < maxRetries; i++) {
      if (this.runState.isShuttingDown()) {
        this.logger.warn(`Task [${task.title}] interrupted before retry ${i + 1}`);
        this.runState.setCurrentTaskStatus('INTERRUPTED');
        return 'INTERRUPTED';
      }

      this.runState.incAttempt();
      this.logger.taskAttemptFix(task, i + 1);

      const fixed = await this.runOnceAfterBuildFailure(task, buildRes);
      if (!fixed) continue;
      const blocker = this.extractBlocker(task.result);
      if (blocker) {
        task.blocker = blocker;
        task.result = blocker.message;
        this.logger.taskBlocked(task);
        this.runState.setCurrentTaskStatus('BLOCKED');
        return 'BLOCKED';
      }

      const retryBuild = await this.buildForTask(task);
      this.logger.taskBuildResult(task, { phase: 'retry', result: retryBuild });
      if (retryBuild.success) {
        this.logger.taskDone(task);
        this.runState.setCurrentTaskStatus('DONE');
        return 'DONE';
      }
    }

    this.logger.taskFailed(task);
    this.runState.setCurrentTaskStatus('FAILED');
    return 'FAILED';
  }

  private extractBlocker(result?: string): Task['blocker'] | null {
    if (!result || typeof result !== 'string') return null;
    const trimmed = result.trim();
    if (!trimmed.startsWith('BLOCKED')) return null;

    const typeMatch = trimmed.match(/TYPE:\s*(missing_dependency|missing_requirement|missing_access|unknown)/i);
    const packageMatch = trimmed.match(/PACKAGE:\s*(.+)/i);
    const reasonMatch = trimmed.match(/REASON:\s*([\s\S]+)/i);

    const type = (typeMatch?.[1]?.toLowerCase() as NonNullable<Task['blocker']>['type'] | undefined) || 'unknown';
    const packageName = packageMatch?.[1]?.trim();
    const message = reasonMatch?.[1]?.trim() || 'Task blocked by an external requirement.';

    return {
      type,
      packageName: packageName && packageName !== '<package-name-or-empty>' ? packageName : undefined,
      message,
    };
  }

  private async runOnce(task: Task): Promise<boolean> {
    const messages = await this.prompt.buildTaskExecutionMessages(task);
    this.logger.promptToLLM(task);
    const ok = await this.runLLMLoop(task, messages);
    this.logger.llmResult(task, ok);
    return ok;
  }

  private async runOnceAfterBuildFailure(task: Task, buildRes: BuildResult): Promise<boolean> {
    if (this.runState.isShuttingDown()) return false;
    this.logger.taskRetryPrompt(task);
    LLMRunner.warnRetry(this.logger, task);
    const messages = await this.prompt.buildTaskRetryMessages(task, buildRes);
    const ok = await this.runLLMLoop(task, messages);
    this.logger.llmResult(task, ok);
    return ok;
  }

  private async buildForTask(task: Task): Promise<BuildResult> {
    const packageDirs = this.getPackageDirsForTask(task);
    this.logger.setTaskProjects(task, this.getProjectsForDirs(packageDirs));
    if (!packageDirs.length) return this.scripts.build();
    return this.scripts.installAndBuildPackages(packageDirs);
  }

  private getPackageDirsForTask(task: Task): string[] {
    const touched = this.logger.getTaskFilesTouched(task);
    const codeFiles = touched.filter(f => this.isCodeFile(f));
    if (!codeFiles.length) return [];
    const root = this.repoContext.get().codePath;
    const dirs = new Set<string>();
    for (const file of codeFiles) {
      const pkgDir = this.findNearestPackageDir(root, file);
      if (pkgDir) dirs.add(pkgDir);
    }
    return Array.from(dirs);
  }

  private findNearestPackageDir(root: string, relFile: string): string | null {
    let current = path.resolve(root, path.dirname(relFile));
    const rootResolved = path.resolve(root);
    while (current.startsWith(rootResolved)) {
      const pkgPath = path.join(current, 'package.json');
      if (fs.existsSync(pkgPath)) {
        return path.relative(rootResolved, current) || '.';
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return null;
  }

  private isCodeFile(filePath: string): boolean {
    const ext = path.extname(filePath || '').toLowerCase();
    const codeExts = new Set([
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.sh', '.bash', '.zsh',
      '.py', '.rb', '.php', '.java', '.go', '.rs',
      '.html', '.htm', '.css', '.scss'
    ]);
    return codeExts.has(ext);
  }

  private getProjectsForDirs(packageDirs: string[]): Array<{ packageJson: string; name: string }> {
    const root = this.repoContext.get().codePath;
    const out: Array<{ packageJson: string; name: string }> = [];
    for (const dir of packageDirs) {
      const pkgPath = path.join(root, dir, 'package.json');
      let name = path.basename(dir);
      try {
        const raw = fs.readFileSync(pkgPath, 'utf-8');
        const json = JSON.parse(raw);
        if (json?.name) name = json.name;
      } catch {}
      out.push({ packageJson: path.relative(root, pkgPath), name });
    }
    return out;
  }

  private async runLLMLoop(task: Task, messages: any[]): Promise<boolean> {
    // IMPORTANTE: qui NON controlliamo shutdown a metà di un’operazione atomica
    const maxToolCalls = this.repoContext.get().agentPolicy.maxToolCallsPerTask ?? ENV.MAX_TOOL_CALLS_PER_TASK;
    return LLMRunner.runLoop(task, messages, {
      llm: this.llm,
      tools: this.tools,
      logger: this.logger,
      llmProfileResolver: this.llmProfileResolver,
      repoContext: this.repoContext,
      maxToolCalls
    });
  }
}
