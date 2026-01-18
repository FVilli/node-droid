import { BeforeApplicationShutdown, Injectable, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { ENV } from './env';
import { readRepoFileSafe, sleep } from './libs/utils';

import { RunStateService } from './services/run-state.service';
import { WorkspaceService } from './services/workspace.service';
import { RepoContextService } from './services/repo-context.service';
import { GitService } from './services/git.service';
import { TaskExtractionService } from './services/task-extraction.service';
import { TaskNormalizationService } from './services/task-normalization.service';
import { TaskQueueService } from './services/task-queue.service';
import { TaskExecutorService } from './services/task-executor.service';
import { RunLoggerService } from './services/run-logger.service';
import { MergeRequestService } from './services/merge-request.service';
import { RawTask } from './interfaces';
import { extractFilePaths } from './libs/utils';

@Injectable()
export class AppService implements OnApplicationBootstrap, BeforeApplicationShutdown {

  private isShuttingDown = false;

  constructor(
    private readonly runState: RunStateService,
    private readonly workspace: WorkspaceService,
    private readonly repoContext: RepoContextService,
    private readonly git: GitService,
    private readonly taskExtraction: TaskExtractionService,
    private readonly taskNormalization: TaskNormalizationService,
    private readonly taskQueue: TaskQueueService,
    private readonly taskExecutor: TaskExecutorService,
    private readonly logger: RunLoggerService,
    private readonly mr: MergeRequestService,
  ) {}

  onApplicationBootstrap() {
    setImmediate(async () => { await this.loop(); });
  }

  async beforeApplicationShutdown(signal: string) {
    console.log(`[node-droid] shutdown requested (${signal})`);
    this.isShuttingDown = true;
    this.runState.setShuttingDown(true);
  }

  private async loop() {
    while (!this.isShuttingDown) {
      try { await this.tick(); }
      catch (err) { console.error('[node-droid] fatal error:', err); }
      if (!this.isShuttingDown) await sleep(ENV.WATCH_INTERVAL);
    }
    console.log('[node-droid] loop terminated');
  }

  private async tick() {
    if (this.isShuttingDown) return;

    // 1) Discover repos
    const repos = this.workspace.listRepos();
    console.log(`[node-droid] found ${repos.length} repos`);
    if (!repos.length || this.isShuttingDown) return;

    for(const repo of repos) { 

      // 2) Set repo context
      const llmProfile = null; // TODO: usare LLMProfileResolverService
      const ctx = this.repoContext.setRepo(repo, llmProfile);
      if (this.isShuttingDown) return;

      // 3) Ensure clone + checkout base
      this.git.ensureCloned(repo.config.remote);
      this.git.checkout(repo.config.baseBranch);
      this.git.fetch();
      if (this.isShuttingDown) return;

      // 4) Remote delta (robusto)
      const delta = this.git.getRemoteDelta(repo.config.baseBranch);
      if (this.isShuttingDown) return;
      if (delta.error) { this.logger.warn(`Git delta error: ${delta.error}`); return; }


      // 5) Bootstrap run
      const runId = Date.now().toString();
      const branch = `${ENV.AI_BRANCH_PREFIX}/${runId}`;

      this.runState.reset();
      this.runState.setStatus('RUNNING');
      this.logger.init(runId, ctx.id);

      this.git.createBranch(branch);
      if (this.isShuttingDown) {
        this.logger.runInterrupted('Shutdown during bootstrap');
        this.runState.setStatus('INTERRUPTED');
        return;
      }

      // 6) File scoping from remote delta
      const changedFiles = extractFilePaths(delta.files);
      if (this.isShuttingDown) return;

      // 7) Task extraction
      let rawTasks: RawTask[] = [];
      for (const file of changedFiles) {
        if (this.isShuttingDown) break;
        if (!file.endsWith('.ts') && file !== ENV.AI_TODO_FILE) continue;

        const content = readRepoFileSafe(ctx.codePath, file);
        if (!content) continue;

        const tasks = await this.taskExtraction.extractFromFile(file, content);
        rawTasks = rawTasks.concat(tasks);
      }

      const tasks = this.taskNormalization.normalize(rawTasks);
      this.taskQueue.set(tasks);

      // 8) Task loop (Politica B)
      while (this.taskQueue.hasNext()) {
        if (this.isShuttingDown) {
          this.logger.warn('Shutdown requested: no new tasks will be started');
          this.runState.setStatus('INTERRUPTED');
          break;
        }

        const task = this.taskQueue.next();
        if (!task) break;

        const result = await this.taskExecutor.execute(task);

        if (result === 'DONE') this.taskQueue.markDone(task.id);
        if (result === 'FAILED') {
          this.taskQueue.markFailed(task.id);
          this.runState.setStatus('FAILED');
          break;
        }

        if (result === 'INTERRUPTED') {
          this.logger.warn(`Task ${task.id} interrupted; stopping run`);
          this.taskQueue.markFailed(task.id);
          this.runState.setStatus('INTERRUPTED');
          break;
        }
      }

      // 9) Finalization
      const status = this.runState.getStatus();

      if (status === 'INTERRUPTED') {
        this.logger.runInterrupted('Shutdown requested; run stopped after current task');
        return;
      }

      if (status === 'FAILED') {
        this.logger.runFailed('Task failed; MR will not be created');
        return;
      }

      // 10) Commit + push
      this.git.commit(`[ai] run ${runId}`);
      this.git.push(branch);
      if (this.isShuttingDown) return;

      // 11) MR
      await this.mr.create({ branch, runId });

      this.logger.runCompleted();
      this.runState.setStatus('COMPLETED');
    }
  }
}