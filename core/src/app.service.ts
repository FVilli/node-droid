import { BeforeApplicationShutdown, Injectable, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { ENV } from './env';
import { getRunId, readRepoFileSafe, sleep } from './libs/utils';

import { RunStateService } from './services/run-state.service';
import { WorkspaceService } from './services/workspace.service';
import { RepoContextService } from './services/repo-context.service';
import { GitService } from './services/git.service';
import { TaskExtractionService } from './services/task-extraction.service';
import { TaskExecutorService } from './services/task-executor.service';
import { RunLoggerService } from './services/run-logger.service';
import { Task } from './interfaces';
import { title } from 'process';
import { FileSystemToolService } from './services/filesystem-tool.service';

@Injectable()
export class AppService implements OnApplicationBootstrap, BeforeApplicationShutdown {

  private isShuttingDown = false;

  constructor(
    private readonly runState: RunStateService,
    private readonly workspace: WorkspaceService,
    private readonly repoContext: RepoContextService,
    private readonly git: GitService,
    private readonly taskExtraction: TaskExtractionService,
    private readonly taskExecutor: TaskExecutorService,
    private readonly logger: RunLoggerService,
    private readonly fileSystemTool: FileSystemToolService,
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
    console.log(`🤖 found ${repos.length} repos`);
    if (!repos.length || this.isShuttingDown) return;

    for(const repo of repos) { 

      const runId = getRunId();
      console.log(`🤖 Repo:${repo.id} RunId:${runId}`);

      // 2) Set repo context
      const llmProfile = null; // TODO: usare LLMProfileResolverService
      const ctx = this.repoContext.setRepo(repo, llmProfile);
      if (this.isShuttingDown) return;

      // 3) Ensure clone
      this.git.ensureCloned(repo.config.remote);
      if (this.isShuttingDown) return;

      // 4) Remote delta (robusto)
      const updates = this.git.getLastCommits(repo.config.baseBranch);
      console.log(updates);
      if (this.isShuttingDown) return;
      if (updates.error) { this.logger.warn(`Get Updates error: ${updates.error}`); continue; }
      if (updates.branch !== repo.config.baseBranch) { this.logger.warn(`Get Updates error: folder is not on the correct branch`); continue; }
      if (updates.files.length===0) { this.logger.info(`branch is up to date`); continue; }

      const commitAi = updates.commits.find(c => c.includes(ENV.AI_COMMIT_TAG));
      if (!commitAi) continue;

      this.git.pull(repo.config.baseBranch);

      // 5) File scoping from remote delta
      if (this.isShuttingDown) return;

      // 6) Task extraction
      let tasks: Task[] = [];
      for (const file of updates.files) {
        if (this.isShuttingDown) break;
        if (!file.endsWith('.ts') && !file.endsWith(ENV.AI_TODO_FILE)) continue;

        const content = readRepoFileSafe(ctx.codePath, file);
        if (!content) continue;

        const _tasks = await this.taskExtraction.extractFromFile(file, content);
        console.log(_tasks);
        tasks = tasks.concat(_tasks);
      }

      // controllo se ci sono task e allora procedo, altrimenti skippo
      if (tasks.length === 0) {
        console.log(`🤖 No tasks extracted; skipping run`);
        continue;
      }

      // 7) Bootstrap run
     
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

      // 8) Task loop (Politica B)
      for (const task of tasks) {
        if (this.isShuttingDown) {
          this.logger.warn('Shutdown requested: no new tasks will be started');
          this.runState.setStatus('INTERRUPTED');
          break;
        }

        const result = await this.taskExecutor.execute(task);

        console.log(task,result)

        if (result === 'DONE') task.status = 'DONE';
        if (result === 'FAILED') {
          task.status = 'FAILED';
          this.runState.setStatus('FAILED');
          break;
        }

        if (result === 'INTERRUPTED') {
          this.logger.warn(`Task [${task.title}] interrupted; stopping run`);
          task.status = 'FAILED';
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

      this.fileSystemTool.createFile({ path: ".ai.log.txt", content: `# AI Tasks\n\nRun ${runId} completed with status: ${status}\n\n---\n\n${tasks.map(t => `- [${t.status==='DONE'?'x':' '}] ${t.title}`).join('\n')}\n` });

      // 10) Commit + push
      this.git.commit(`Job DONE`);
      this.git.push(branch);
      if (this.isShuttingDown) return;

      const title = `AI Automation Run ${runId}`;
      const body = `This PR was automatically created by node-droid AI automation.\n\nRun ID: ${runId}\n\n---\n\n${tasks.map(t => `- [${t.status==='DONE'?'x':' '}] ${t.title}`).join('\n')}`;

      // 11) Pull Request
      await this.git.createPR(repo.config.baseBranch, branch, title, body, repo.config.token);

      this.logger.runCompleted();
      this.runState.setStatus('COMPLETED');
    }
  }
}