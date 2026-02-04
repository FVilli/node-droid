import { BeforeApplicationShutdown, Injectable, OnApplicationBootstrap, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ENV } from './env';
import { getRunId, readRepoFileSafe, sleep } from './libs/utils';
import { RunStateService } from './services/run-state.service';
import { WorkspaceService } from './services/workspace.service';
import { RepoContextService } from './services/repo-context.service';
import { GitService } from './services/git.service';
import { TaskExtractionService } from './services/task-extraction.service';
import { TaskExecutorService } from './services/task-executor.service';
import { RunLoggerService } from './services/run-logger.service';
import { Task } from './types';
import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';
import { ScriptsService } from './services/build.service';
import { TranslateToEnglishService } from './services/translate-to-english.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class AppService implements BeforeApplicationShutdown {

  private isShuttingDown = false;
  private isWorking = false;

  constructor(
    private readonly runState: RunStateService,
    private readonly workspace: WorkspaceService,
    private readonly repoContext: RepoContextService,
    private readonly git: GitService,
    private readonly taskExtraction: TaskExtractionService,
    private readonly taskExecutor: TaskExecutorService,
    private readonly logger: RunLoggerService,
    private readonly scripts: ScriptsService,
    private readonly translateToEnglish: TranslateToEnglishService,
  ) {}
 
  async beforeApplicationShutdown(signal: string) {
    this.logger.warn(`Shutdown requested (${signal})`);
    this.isShuttingDown = true;
    this.runState.setShuttingDown(true);
  }

  // @Cron('0 * * * * *')

  // private async loop() {
  //   while (!this.isShuttingDown) {
  //     try { await this.tick(); }
  //     catch (err) { this.logger.error(`[node-droid] fatal error: ${err}`); }
  //     // await this.waitForNextTick();
  //   }
  //   this.logger.info('[node-droid] loop terminated');
  // }

  // private async waitForNextTick() {
  //   let remaining = Math.max(10, ENV.WATCH_INTERVAL);
  //   const spinner = ora({ text: `...` }).start();
  //   try {
  //     while (remaining > 0 && !this.isShuttingDown) {
  //       spinner.text = `${remaining}`;
  //       await sleep(1000);
  //       remaining--;
  //     }
  //   } finally {
  //     spinner.stop();
  //   }
  // }

  @Cron('0 * * * * *')
  private async tick() {
    if (this.isShuttingDown) return;
    if (this.isWorking) return;
    this.isWorking = true;
    
    // 1) Discover repos
    const repos = this.workspace.listRepos();
    this.logger.scanRepos(repos.length);
    if (!repos.length || this.isShuttingDown) return;

    for(const repo of repos) { 

      const runId = getRunId();
      this.logger.event('📥', `Get updates for Repo [${repo.id}]`);

      // 2) Set repo context
      const llmProfile = null; // TODO: usare LLMProfileResolverService
      const ctx = this.repoContext.setRepo(repo, llmProfile);
      if (this.isShuttingDown) return;

      // 3) Ensure clone
      this.git.ensureCloned(repo.config.remote);
      if (this.isShuttingDown) return;

      // 4) Remote delta (robusto)
      const updates = this.git.getLastCommits(repo.config.baseBranch);
      if (this.isShuttingDown) return;
      if (updates.error) { this.logger.warn(`Get updates error: ${updates.error}`); continue; }
      if (updates.branch !== repo.config.baseBranch) { this.logger.warn('Get updates error: branch mismatch'); continue; }
      if (updates.files.length===0) { this.logger.event('☕', `Branch [${updates.branch}] is up to date`); continue; }

      this.git.pull(repo.config.baseBranch);
      const headSubject = this.stripCommitTag(this.git.getHeadSubject(), ENV.AI_COMMIT_TAG);

      const commitAi = updates.commits.find(c => c.includes(ENV.AI_COMMIT_TAG));
      if (!commitAi) {
        this.logger.event('🤖', 'No AI-tagged commits found; skipping task run');
        continue;
      }

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
        tasks = tasks.concat(_tasks);
      }

      // controllo se ci sono task e allora procedo, altrimenti skippo
      if (tasks.length === 0) {
        const commitMessage = this.stripCommitTag(commitAi, ENV.AI_COMMIT_TAG);
        this.logger.event('🤖', `No tasks extracted (skipping run) for commit [${commitMessage}]`);
        continue;
      }

      console.log("tasks extracted:", tasks.length);

      const commitMessage = this.stripCommitTag(commitAi, ENV.AI_COMMIT_TAG);
      this.logger.triggerDetected(commitMessage, tasks.length);
      for (let i = 0; i < tasks.length; i++) {
        this.logger.extractedTask(i + 1, tasks[i].title);
      }

      if (this.isShuttingDown) return;
      await this.translateToEnglish.translateTasks(tasks);

      // 7) Bootstrap run
     
      const branch = `${ENV.AI_BRANCH_PREFIX}/${runId}`;

      this.runState.reset();
      this.runState.setStatus('RUNNING');
      this.logger.init(runId, ctx.id, headSubject);
      this.logger.runCreated(runId);
      this.git.createBranch(branch);
      if (this.isShuttingDown) {
        this.logger.runInterrupted('Shutdown during bootstrap');
        this.runState.setStatus('INTERRUPTED');
        return;
      }

      // 8) Task loop (Politica B)
      let hadFailures = false;
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        if (this.isShuttingDown) {
          this.logger.warn('Shutdown requested; no new tasks will be started');
          this.runState.setStatus('INTERRUPTED');
          break;
        }

        const result = await this.taskExecutor.execute(task);

        this.logger.taskOutcome(i + 1, task.title, result);

        if (result === 'DONE') task.status = 'DONE';
        if (result === 'FAILED') {
          task.status = 'FAILED';
          hadFailures = true;
          this.runState.setStatus('FAILED');
        }

        if (result === 'INTERRUPTED') {
          this.logger.warn(`Task [${task.title}] interrupted; stopping run`);
          task.status = 'FAILED';
          this.runState.setStatus('INTERRUPTED');
          break;
        }
      }

      await this.cleanupTaskMarkers(tasks, ctx.codePath, runId);

      // 9) Finalization
      const status = this.runState.getStatus();

      if (status === 'INTERRUPTED') {
        this.logger.runInterrupted('Shutdown requested; run stopped after current task');
        return;
      }

      if (status === 'FAILED' || hadFailures) {
        this.logger.runFailed('One or more tasks failed');
      } else {
        this.logger.runCompleted();
      }

      // 10) Commit + push
      const commitMsg = status === 'FAILED' || hadFailures ? 'Job failed.' : 'Job done !';
      this.git.commit(commitMsg);
      this.git.push(branch);
      if (this.isShuttingDown) return;

      const title = `AI Automation Run ${runId}`;
      const body = this.logger.getPrSummary();

      // 11) Pull Request
      const prUrl = (await this.git.createPR(repo.config.baseBranch, branch, title, body, repo.config.token)).trim();
      if (prUrl) this.logger.event('📡', `Created PR [${prUrl}]`);
      if (status !== 'FAILED' && !hadFailures) {
        this.runState.setStatus('COMPLETED');
      }
    }
    this.isWorking = false;
    this.logger.event('🐧', 'Waiting next tick ...');
  }

  private async cleanupTaskMarkers(tasks: Task[], repoPath: string, runId: string) {
    const mdFiles = new Set<string>();
    const tsFileTasks = new Map<string, Array<{ line?: number; title: string; taskNumber: number; runId: string; status: Task['status']; result?: string }>>();

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
          result: task.result
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
        this.logger.warn(`Failed to remove task file [${file}]: ${err.message || err}`);
      }
    }

    for (const [file, tasksForFile] of tsFileTasks.entries()) {
      const full = this.resolveRepoPath(repoPath, file);
      if (!full) continue;
      try {
        const original = fs.readFileSync(full, 'utf-8');
        const cleaned = this.transformTaskComments(original, ENV.AI_TODO_COMMENT, tasksForFile);
        if (cleaned !== original) {
          fs.writeFileSync(full, cleaned, 'utf-8');
          this.logger.event('🧹', `Updated task comments in [${file}]`);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to clean task comments in [${file}]: ${err.message || err}`);
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
    tasks: Array<{ line?: number; title: string; taskNumber: number; runId: string; status: Task['status']; result?: string }>
  ): string {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lineSet = new Set(tasks.map(t => t.line).filter(Boolean) as number[]);
    const titles = tasks.map(t => t.title).filter(Boolean);
    const tasksByLine = new Map<number, { line?: number; title: string; taskNumber: number; runId: string; status: Task['status']; result?: string }>();
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
      const matchesTitle = titles.some(t => line.includes(t));

      if (!hasTag || (!matchesLine && !matchesTitle)) {
        out.push(line);
        continue;
      }

      if (line.includes(`//`) && (matchesLine || matchesTitle)) {
        const task = tasksByLine.get(lineNumber) || tasks.find(t => line.includes(t.title));
        if (task) {
          const statusEmoji = task.status === 'FAILED' ? '❌' : '✅';
          const reason = task.status === 'FAILED'
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
    return subject.replace(new RegExp(escaped, 'g'), '').replace(/\s+/g, ' ').trim();
  }
}
