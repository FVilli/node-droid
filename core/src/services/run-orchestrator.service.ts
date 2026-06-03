import { Injectable } from '@nestjs/common';
import { ENV } from '../env';
import { getRunId, readRepoFileSafe } from '../libs/utils';
import { RunContext, Task, TaskBlock, RepoDescriptor } from '../types';
import { RunStateService } from './run-state.service';
import { RepoContextService } from './repo-context.service';
import { GitService } from './git.service';
import { TaskExtractionService } from './task-extraction.service';
import { TaskNormalizationService } from './task-normalization.service';
import { TaskQueueService } from './task-queue.service';
import { TaskExecutorService } from './task-executor.service';
import { RunLoggerService } from './run-logger.service';
import { TranslateToEnglishService } from './translate-to-english.service';
import { MergeRequestService } from './merge-request.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RunOrchestratorService {
  constructor(
    private readonly runState: RunStateService,
    private readonly repoContext: RepoContextService,
    private readonly git: GitService,
    private readonly taskExtraction: TaskExtractionService,
    private readonly taskNormalization: TaskNormalizationService,
    private readonly taskQueue: TaskQueueService,
    private readonly taskExecutor: TaskExecutorService,
    private readonly logger: RunLoggerService,
    private readonly translateToEnglish: TranslateToEnglishService,
    private readonly mergeRequest: MergeRequestService,
  ) {}

  async runRepo(
    repo: RepoDescriptor,
    isShuttingDown: boolean,
  ): Promise<boolean> {
    const runId = getRunId();
    this.logger.event('📥', `Get updates for Repo [${repo.id}]`);

    const ctx = this.repoContext.setRepo(repo, repo.config.llm || null);
    if (isShuttingDown) return false;

    this.git.ensureCloned(repo.config.remote);
    if (isShuttingDown) return false;

    const updates = this.git.getLastCommits(repo.config.baseBranch);
    if (isShuttingDown) return false;
    if (updates.error) {
      this.logger.warn(`Get updates error: ${updates.error}`);
      return true;
    }
    if (updates.branch !== repo.config.baseBranch) {
      this.logger.warn('Get updates error: branch mismatch');
      return true;
    }
    if (updates.files.length === 0) {
      this.logger.event('☕', `Branch [${updates.branch}] is up to date`);
      return true;
    }

    this.git.pull(repo.config.baseBranch);
    const headSubject = this.stripCommitTag(
      this.git.getHeadSubject(),
      ENV.AI_COMMIT_TAG,
    );

    const commitAi = updates.commits.find((c) => c.includes(ENV.AI_COMMIT_TAG));
    if (!commitAi) {
      this.logger.event('🤖', 'No AI-tagged commits found; skipping task run');
      return true;
    }

    let tasks: Task[] = [];
    this.runState.setPhase('TASK_EXTRACTION');
    for (const file of updates.files) {
      if (isShuttingDown) break;
      if (!file.endsWith('.ts') && !file.endsWith(ENV.AI_TODO_FILE)) continue;

      const content = readRepoFileSafe(ctx.codePath, file);
      if (!content) continue;

      const extracted = await this.taskExtraction.extractFromFile(
        file,
        content,
      );
      tasks = tasks.concat(extracted);
    }

    tasks = this.taskNormalization.normalize(tasks);

    if (tasks.length === 0) {
      const commitMessage = this.stripCommitTag(commitAi, ENV.AI_COMMIT_TAG);
      this.logger.event(
        '🤖',
        `No tasks extracted (skipping run) for commit [${commitMessage}]`,
      );
      return true;
    }

    const commitMessage = this.stripCommitTag(commitAi, ENV.AI_COMMIT_TAG);
    this.logger.triggerDetected(commitMessage, tasks.length);
    for (let i = 0; i < tasks.length; i++) {
      this.logger.extractedTask(i + 1, tasks[i].title);
    }

    if (isShuttingDown) return false;
    await this.translateToEnglish.translateTasks(tasks);
    const taskBlocks = this.buildTaskBlocks(tasks);

    const branch = `${ENV.AI_BRANCH_PREFIX}/${runId}`;

    this.runState.reset();
    const runContext: RunContext = {
      runId,
      repoId: ctx.id,
      branchName: branch,
      triggerCommit: { message: commitMessage },
      startedAt: new Date().toISOString(),
    };
    this.runState.startRun(runContext);
    this.logger.init(runId, ctx.id, headSubject);
    this.logger.runCreated(runId);
    this.git.createBranch(branch);
    if (isShuttingDown) {
      this.logger.runInterrupted('Shutdown during bootstrap');
      this.runState.setStatus('INTERRUPTED');
      return false;
    }

    this.taskQueue.loadBlocks(taskBlocks);
    this.logger.taskBlocksPlanned(taskBlocks);
    this.runState.setPhase('TASK_EXECUTION');

    let hadFailures = false;
    let globalTaskIndex = 0;

    for (let blockIndex = 0; blockIndex < taskBlocks.length; blockIndex++) {
      const block = taskBlocks[blockIndex];
      this.logger.taskBlockStart(blockIndex + 1, block.title);

      const blockIssues: string[] = [];
      let interrupted = false;
      let interruptReason = '';
      let nextTaskIndexInBlock = 0;

      for (let taskIndex = 0; taskIndex < block.tasks.length; taskIndex++) {
        nextTaskIndexInBlock = taskIndex + 1;
        const task = block.tasks[taskIndex];
        globalTaskIndex++;
        this.runState.setCurrentTask({
          id: task.id,
          title: task.title,
          index: globalTaskIndex,
          status: task.status,
        });
        if (isShuttingDown || this.runState.isShuttingDown()) {
          this.logger.warn('Shutdown requested; no new tasks will be started');
          this.runState.setStatus('INTERRUPTED');
          interrupted = true;
          interruptReason = 'Run interrupted before starting the next task.';
          nextTaskIndexInBlock = taskIndex;
          break;
        }

        const result = await this.taskExecutor.execute(task);
        this.logger.taskOutcome(globalTaskIndex, task.title, result);

        if (result === 'DONE') {
          this.taskQueue.mark(task.id, 'DONE');
          this.runState.setCurrentTaskStatus('DONE');
          continue;
        }

        if (result === 'BLOCKED') {
          this.taskQueue.mark(task.id, 'BLOCKED');
          this.runState.setCurrentTaskStatus('BLOCKED');
          hadFailures = true;
          blockIssues.push(`Task [${task.title}] blocked.`);
          this.runState.setStatus('FAILED');
          continue;
        }

        if (result === 'FAILED') {
          this.taskQueue.mark(task.id, 'FAILED');
          this.runState.setCurrentTaskStatus('FAILED');
          hadFailures = true;
          blockIssues.push(`Task [${task.title}] failed.`);
          this.runState.setStatus('FAILED');
          continue;
        }

        if (result === 'INTERRUPTED') {
          this.logger.warn(`Task [${task.title}] interrupted; stopping run`);
          this.taskQueue.mark(task.id, 'FAILED');
          this.runState.setStatus('INTERRUPTED');
          this.runState.setCurrentTaskStatus('INTERRUPTED');
          interrupted = true;
          interruptReason = `Task [${task.title}] interrupted.`;
          break;
        }
      }

      if (interrupted) {
        this.logger.taskBlockStop(blockIndex + 1, block.title, interruptReason);
        const deferredBlocks = this.getDeferredBlocksAfterStop(
          taskBlocks,
          blockIndex,
          nextTaskIndexInBlock,
        );
        this.deferTaskBlocks(deferredBlocks, interruptReason);
        break;
      }

      if (blockIssues.length) {
        const reason = blockIssues.join(' ');
        this.logger.taskBlockStop(blockIndex + 1, block.title, reason);
        this.deferTaskBlocks(taskBlocks.slice(blockIndex + 1), reason);
        break;
      }
    }

    tasks = this.taskQueue.list();

    this.runState.setPhase('FINALIZATION');
    await this.cleanupTaskMarkers(tasks, ctx.codePath, runId);

    let status = this.runState.getStatus();
    if (status === 'INTERRUPTED') {
      this.logger.runInterrupted(
        'Shutdown requested; run stopped after current task',
      );
      this.runState.setPhase('FAILED');
      this.runState.clearCurrentTask();
      return false;
    }

    const commitMsg =
      status === 'FAILED' || hadFailures ? 'Job failed.' : 'Job done !';
    this.git.commit(commitMsg);
    this.git.push(branch);
    if (isShuttingDown) {
      this.runState.setStatus('INTERRUPTED');
      this.logger.runInterrupted('Shutdown requested after push');
      this.runState.setPhase('FAILED');
      this.runState.clearCurrentTask();
      return false;
    }

    const prUrl = await this.mergeRequest.create(
      repo.config.baseBranch,
      branch,
      runId,
      repo.config.token,
    );
    if (prUrl) this.logger.event('📡', `Created PR [${prUrl}]`);
    if (status === 'FAILED' || hadFailures) {
      this.logger.runFailed('One or more tasks failed');
    } else {
      this.runState.setStatus('COMPLETED');
      this.logger.runCompleted();
    }
    status = this.runState.getStatus();
    this.runState.setPhase(
      this.runState.getStatus() === 'COMPLETED' ? 'DONE' : 'FAILED',
    );
    this.runState.clearCurrentTask();

    return true;
  }

  private buildTaskBlocks(tasks: Task[]): TaskBlock[] {
    const blocks = new Map<string, TaskBlock>();

    for (const task of tasks) {
      const targetDir = this.getTaskTargetDir(task);
      const key = this.getTaskBlockKey(task, targetDir);
      const existing = blocks.get(key);
      if (existing) {
        existing.tasks.push(task);
        continue;
      }

      blocks.set(key, {
        id: `block-${blocks.size + 1}`,
        title: this.getTaskBlockTitle(task, targetDir),
        targetDir,
        tasks: [task],
      });
    }

    return Array.from(blocks.values());
  }

  private getTaskBlockKey(task: Task, targetDir: string): string {
    if (task.source === 'ts' && task.file) return `file:${task.file}`;
    return `dir:${targetDir}`;
  }

  private getTaskBlockTitle(task: Task, targetDir: string): string {
    if (task.source === 'ts' && task.file) return task.file;
    return targetDir === '.' ? 'Repository tasks' : `Tasks in ${targetDir}`;
  }

  private getTaskTargetDir(task: Task): string {
    if (!task.file) return '.';
    const dir = path.dirname(task.file);
    return dir && dir !== '.' ? dir : '.';
  }

  private deferTaskBlocks(blocks: TaskBlock[], reason: string) {
    if (!blocks.length) return;
    for (const block of blocks) {
      for (const task of block.tasks) {
        task.status = 'DEFERRED';
        task.result = reason;
        this.taskQueue.mark(task.id, 'DEFERRED');
        this.logger.taskDeferred(task, reason);
      }
    }
    this.logger.writeDeferredTaskBlocks(blocks, reason);
  }

  private getDeferredBlocksAfterStop(
    blocks: TaskBlock[],
    stoppedBlockIndex: number,
    nextTaskIndexInBlock: number,
  ): TaskBlock[] {
    const stoppedBlock = blocks[stoppedBlockIndex];
    const remainingCurrentTasks = stoppedBlock.tasks.slice(nextTaskIndexInBlock);
    const deferred: TaskBlock[] = [];

    if (remainingCurrentTasks.length) {
      deferred.push({
        ...stoppedBlock,
        id: `${stoppedBlock.id}-remaining`,
        title: `${stoppedBlock.title} (remaining tasks)`,
        tasks: remainingCurrentTasks,
      });
    }

    deferred.push(...blocks.slice(stoppedBlockIndex + 1));
    return deferred;
  }

  private async cleanupTaskMarkers(
    tasks: Task[],
    repoPath: string,
    runId: string,
  ) {
    const mdFiles = new Set<string>();
    const tsFileTasks = new Map<
      string,
      Array<{
        line?: number;
        title: string;
        taskNumber: number;
        runId: string;
        status: Task['status'];
        result?: string;
      }>
    >();

    for (let index = 0; index < tasks.length; index++) {
      const task = tasks[index];
      if (!task.file) continue;
      if (task.source === 'md' && task.file.endsWith(ENV.AI_TODO_FILE)) {
        mdFiles.add(task.file);
      }
      if (task.source === 'ts' && task.file.endsWith('.ts')) {
        if (!tsFileTasks.has(task.file)) tsFileTasks.set(task.file, []);
        tsFileTasks.get(task.file)?.push({
          line: task.line,
          title: task.title,
          taskNumber: index + 1,
          runId,
          status: task.status,
          result: task.result,
        });
      }
    }

    for (const file of mdFiles) {
      const full = this.resolveRepoPath(repoPath, file);
      if (!full) continue;
      try {
        fs.unlinkSync(full);
        this.logger.event('🗑️', `Removed task file [${file}]`);
      } catch (err: any) {
        this.logger.warn(
          `Failed to remove task file [${file}]: ${err.message || err}`,
        );
      }
    }

    for (const [file, tasksForFile] of tsFileTasks.entries()) {
      const full = this.resolveRepoPath(repoPath, file);
      if (!full) continue;
      try {
        const original = fs.readFileSync(full, 'utf-8');
        const cleaned = this.transformTaskComments(
          original,
          ENV.AI_TODO_COMMENT,
          tasksForFile,
        );
        if (cleaned !== original) {
          fs.writeFileSync(full, cleaned, 'utf-8');
          this.logger.event('🧹', `Updated task comments in [${file}]`);
        }
      } catch (err: any) {
        this.logger.warn(
          `Failed to clean task comments in [${file}]: ${err.message || err}`,
        );
      }
    }
  }

  private resolveRepoPath(repoPath: string, file: string): string | null {
    const full = path.resolve(repoPath, file);
    if (!full.startsWith(path.resolve(repoPath))) return null;
    return full;
  }

  private transformTaskComments(
    content: string,
    tag: string,
    tasks: Array<{
      line?: number;
      title: string;
      taskNumber: number;
      runId: string;
      status: Task['status'];
      result?: string;
    }>,
  ): string {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lineSet = new Set(
      tasks.map((t) => t.line).filter(Boolean) as number[],
    );
    const titles = tasks.map((t) => t.title).filter(Boolean);
    const tasksByLine = new Map<
      number,
      {
        line?: number;
        title: string;
        taskNumber: number;
        runId: string;
        status: Task['status'];
        result?: string;
      }
    >();
    for (const task of tasks) {
      if (task.line) tasksByLine.set(task.line, task);
    }
    const out: string[] = [];
    const src = content.split('\n');

    for (let i = 0; i < src.length; i++) {
      const lineNumber = i + 1;
      const line = src[i];
      const hasTag = new RegExp(escaped).test(line);

      const matchesLine = lineSet.has(lineNumber);
      const matchesTitle = titles.some((t) => line.includes(t));

      if (!hasTag || (!matchesLine && !matchesTitle)) {
        out.push(line);
        continue;
      }

      if (line.includes(`//`) && (matchesLine || matchesTitle)) {
        const task =
          tasksByLine.get(lineNumber) ||
          tasks.find((t) => line.includes(t.title));
        if (task) {
          const statusEmoji =
            task.status === 'FAILED'
              ? '❌'
              : task.status === 'BLOCKED'
                ? '⛔'
                : task.status === 'DEFERRED'
                  ? '⏭️'
                  : '✅';
          const reason =
            task.status === 'FAILED' ||
            task.status === 'BLOCKED' ||
            task.status === 'DEFERRED'
              ? ` Reason:${this.formatShortReason(task.result)}`
              : '';
          out.push(`// ${statusEmoji} ${task.title}`);
          out.push(`// [ai<run>:${task.runId}/${task.taskNumber}${reason}]`);
        } else {
          out.push(line);
        }
        continue;
      }

      out.push(line);
    }

    return out.join('\n');
  }

  private formatShortReason(reason?: string): string {
    if (!reason) return 'Unknown';
    const cleaned = reason.replace(/\s+/g, ' ').trim();
    return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
  }

  private stripCommitTag(subject: string, tag: string): string {
    if (!subject || !tag) return subject;
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return subject
      .replace(new RegExp(escaped, 'g'), '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
