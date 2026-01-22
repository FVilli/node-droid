import { BeforeApplicationShutdown, Injectable, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { ENV } from './env';
import { getRunId, readRepoFileSafe, sleep, toLocalIso } from './libs/utils';
import { RunStateService } from './services/run-state.service';
import { WorkspaceService } from './services/workspace.service';
import { RepoContextService } from './services/repo-context.service';
import { GitService } from './services/git.service';
import { TaskExtractionService } from './services/task-extraction.service';
import { TaskExecutorService } from './services/task-executor.service';
import { RunLoggerService } from './services/run-logger.service';
import { Task } from './types';
import { FileSystemToolService } from './services/filesystem-tool.service';
import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';

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
      await this.waitForNextTick();
    }
    console.log('[node-droid] loop terminated');
  }

  private async waitForNextTick() {
    let remaining = Math.max(10, ENV.WATCH_INTERVAL);
    const spinner = ora({ text: `...` }).start();
    while (remaining > 0 && !this.isShuttingDown) {
      spinner.text = `${remaining}`;
      await sleep(1000);
      remaining--;
    }
    spinner.stop();
  }

  private async tick() {
    if (this.isShuttingDown) return;

    // 1) Discover repos
    const repos = this.workspace.listRepos();
    console.log(`🔍 found ${repos.length} repos`);
    if (!repos.length || this.isShuttingDown) return;

    for(const repo of repos) { 

      const runId = getRunId();
      console.log(`${toLocalIso()} 📥 Repo:${repo.id} RunId:${runId}`);

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
      let hadFailures = false;
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

      await this.cleanupTaskMarkers(tasks, ctx.codePath);

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

      this.fileSystemTool.saveFile({ path: ".ai.log.txt", content: `# AI Tasks\n\nRun ${runId} completed with status: ${status}\n\n---\n\n${tasks.map(t => `- [${t.status==='DONE'?'x':' '}] ${t.title}`).join('\n')}\n` });

      // 10) Commit + push
      this.git.commit(`Job DONE`);
      this.git.push(branch);
      if (this.isShuttingDown) return;

      const title = `AI Automation Run ${runId}`;
      const body = `This PR was automatically created by node-droid AI automation.\n\nRun ID: ${runId}\n\n---\n\n${tasks.map(t => `- [${t.status==='DONE'?'x':' '}] ${t.title}`).join('\n')}`;

      // 11) Pull Request
      await this.git.createPR(repo.config.baseBranch, branch, title, body, repo.config.token);
      if (status !== 'FAILED' && !hadFailures) {
        this.runState.setStatus('COMPLETED');
      }
    }
  }

  private async cleanupTaskMarkers(tasks: Task[], repoPath: string) {
    const mdFiles = new Set<string>();
    const tsFileTasks = new Map<string, Array<{ line?: number; title: string }>>();

    for (const task of tasks) {
      if (!task.file) continue;
      if (task.source === 'md' && task.file.endsWith(ENV.AI_TODO_FILE)) {
        mdFiles.add(task.file);
      }
      if (task.source === 'ts' && task.file.endsWith('.ts')) {
        if (!tsFileTasks.has(task.file)) tsFileTasks.set(task.file, []);
        tsFileTasks.get(task.file)?.push({ line: task.line, title: task.title });
      }
    }

    for (const file of mdFiles) {
      const full = this.resolveRepoPath(repoPath, file);
      if (!full) continue;
      try {
        fs.unlinkSync(full);
        this.logger.info(`Removed task file: ${file}`);
      } catch (err: any) {
        this.logger.warn(`Failed to remove task file ${file}: ${err.message || err}`);
      }
    }

    for (const [file, tasksForFile] of tsFileTasks.entries()) {
      const full = this.resolveRepoPath(repoPath, file);
      if (!full) continue;
      try {
        const original = fs.readFileSync(full, 'utf-8');
        const cleaned = this.stripTaskCommentsByLineOrTitle(original, ENV.AI_TODO_COMMENT, tasksForFile);
        if (cleaned !== original) {
          fs.writeFileSync(full, cleaned, 'utf-8');
          this.logger.info(`Removed task comments from: ${file}`);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to clean task comments in ${file}: ${err.message || err}`);
      }
    }
  }

  private resolveRepoPath(repoPath: string, file: string): string | null {
    const full = path.resolve(repoPath, file);
    if (!full.startsWith(path.resolve(repoPath))) return null;
    return full;
  }

  private stripTaskCommentsByLineOrTitle(
    content: string,
    tag: string,
    tasks: Array<{ line?: number; title: string }>
  ): string {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lineSet = new Set(tasks.map(t => t.line).filter(Boolean) as number[]);
    const titles = tasks.map(t => t.title).filter(Boolean);
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

      if (line.includes(`//`) && matchesTitle) {
        continue;
      }

      if (line.includes('/*')) {
        let block = line;
        let j = i;
        while (j < src.length && !src[j].includes('*/')) {
          j++;
          block += '\n' + (src[j] || '');
        }
        const blockHasTag = new RegExp(escaped).test(block);
        const blockHasTitle = titles.some(t => block.includes(t));
        if (blockHasTag && blockHasTitle) {
          i = j;
          continue;
        }
      }

      out.push(line);
    }

    return out.join('\n');
  }
}
