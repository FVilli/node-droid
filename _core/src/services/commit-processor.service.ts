// packages/core/src/services/commit-processor.service.ts

import { Injectable } from '@nestjs/common';
import simpleGit, { SimpleGit } from 'simple-git';
import { AIAgentService } from './ai-agent.service';
import { MonorepoManagerService } from './monorepo-manager.service';
import { AIActivityLoggerService } from './ai-activity-logger.service';
import { RepomixService } from './repomix.service';
import { RepoManagerService } from './repo-manager.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CommitContext, Task, TaskResult, RepositoryConfig } from '../interfaces';

@Injectable()
export class CommitProcessorService {
  constructor(
    private aiAgent: AIAgentService,
    private monorepo: MonorepoManagerService,
    private logger: AIActivityLoggerService,
    private repomix: RepomixService,
    private repoManager: RepoManagerService
  ) {}

  async process(context: CommitContext, repo: RepositoryConfig) {
    const repoPath = repo.path;
    
    await this.logger.initializeActivity(
      context.commitHash,
      context.commitMessage,
      context.baseBranch,
      repo.name,
      repoPath
    );

    const git = this.repoManager.getGit(repo.name);
    if (!git) {
      this.logger.log('error', `Git instance not found for ${repo.name}`);
      await this.logger.finalizeActivity();
      return;
    }

    try {
      // Invalida la cache di Repomix
      if (this.repomix.getAvailability()) {
        this.logger.log('info', '🔄 Refreshing project context...');
        await this.repomix.invalidateCache(repoPath);
        await this.repomix.generateProjectContext(true, repoPath);
      }

      // Inizializza monorepo per questo repository
      this.monorepo.setCurrentRepository(repoPath);
      
      this.logger.log('info', '🔍 Checking dependencies...');
      await this.monorepo.checkAndInstallDependencies(context.files);

      const branchName = `ai/${context.commitHash.substring(0, 7)}-${Date.now()}`;
      await git.checkoutBranch(branchName, context.baseBranch);
      this.logger.setAIBranch(branchName);

      const tasks = await this.extractTasks(context, repoPath);
      this.logger.setTotalTasks(tasks.length);

      if (tasks.length === 0) {
        this.logger.log('error', 'No tasks found, aborting');
        await this.cleanup(git, branchName, context.baseBranch);
        await this.logger.finalizeActivity();
        return;
      }

      const results: TaskResult[] = [];

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const taskIndex = await this.logger.startTask(i + 1, task.description);

        const result = await this.executeTaskWithValidation(
          task, 
          i + 1, 
          tasks.length, 
          taskIndex, 
          git,
          repoPath
        );
        results.push(result);

        await this.logger.endTask(
          taskIndex,
          result.success,
          result.affectedPackages,
          result.buildSuccess,
          result.testSuccess,
          result.lintSuccess,
          result.error
        );

        if (!result.success) {
          this.logger.log('error', 'Task failed, aborting remaining tasks');
          break;
        }
        
        if (result.success && this.repomix.getAvailability()) {
          await this.repomix.invalidateCache(repoPath);
        }
      }

      const successCount = results.filter(r => r.success).length;
      
      if (successCount === results.length) {
        await this.createMergeRequest(git, branchName, context, results);
      } else {
        this.logger.log('info', `Branch kept for manual review: ${branchName}`);
      }

    } finally {
      await this.logger.finalizeActivity();
    }
  }

  private async executeTaskWithValidation(
    task: Task,
    taskNumber: number,
    totalTasks: number,
    taskIndex: number,
    git: SimpleGit,
    repoPath: string
  ): Promise<TaskResult> {
    try {
      await this.aiAgent.executeTask(task, taskIndex, this.logger, repoPath);

      const changedFiles = await this.getChangedFiles(git);
      const affectedPackages = await this.monorepo.getAffectedPackages(changedFiles);
      
      this.logger.log('info', `Affected packages: ${affectedPackages.map(p => p.name).join(', ') || 'none'}`);

      await this.monorepo.checkAndInstallDependencies(changedFiles);

      let allValid = true;
      let buildSuccess = true;
      let testSuccess = true;
      let lintSuccess = true;
      const validationErrors: string[] = [];

      for (const pkg of affectedPackages) {
        this.logger.log('info', `Validating package: ${pkg.name}`);

        buildSuccess = await this.monorepo.buildPackage(pkg, this.logger);
        if (!buildSuccess) {
          allValid = false;
          validationErrors.push(`Build failed for ${pkg.name}`);
          continue;
        }

        lintSuccess = await this.monorepo.lintPackage(pkg, this.logger);
        testSuccess = await this.monorepo.testPackage(pkg, this.logger);
        
        if (!testSuccess) {
          allValid = false;
          validationErrors.push(`Tests failed for ${pkg.name}`);
        }
      }

      if (!allValid) {
        await git.reset(['--hard', 'HEAD']);
        this.logger.log('error', 'Validation failed, changes rolled back');
        
        return {
          success: false,
          task,
          error: validationErrors.join('; '),
          affectedPackages: affectedPackages.map(p => p.name),
          buildSuccess,
          testSuccess,
          lintSuccess
        };
      }

      await git.add('.');
      const commitMessage = `[AI] Task ${taskNumber}/${totalTasks}: ${task.description}

Affected packages: ${affectedPackages.map(p => p.name).join(', ') || 'none'}`;

      await git.commit(commitMessage);
      this.logger.log('info', 'Changes committed successfully');

      return {
        success: true,
        task,
        affectedPackages: affectedPackages.map(p => p.name),
        buildSuccess,
        testSuccess,
        lintSuccess
      };

    } catch (error) {
      this.logger.log('error', `Task execution error: ${error.message}`);
      await git.reset(['--hard', 'HEAD']);
      
      return {
        success: false,
        task,
        error: error.message,
        affectedPackages: [],
        buildSuccess: false,
        testSuccess: false
      };
    }
  }

  private async getChangedFiles(git: SimpleGit): Promise<string[]> {
    const status = await git.status();
    return [
      ...status.modified,
      ...status.created,
      ...status.deleted,
      ...status.renamed.map(r => r.to)
    ];
  }

  private async cleanup(git: SimpleGit, branchName: string, baseBranch: string) {
    await git.checkout(baseBranch);
    await git.deleteLocalBranch(branchName, true);
  }

  private async extractTasks(context: CommitContext, repoPath: string): Promise<Task[]> {
    const tasks: Task[] = [];

    for (const filePath of context.files) {
      const fullPath = path.join(repoPath, filePath);
      
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const ext = path.extname(filePath);

        if (ext === '.md') {
          tasks.push(...this.extractTasksFromMarkdown(content, filePath));
        } else {
          tasks.push(...this.extractTasksFromCode(content, filePath));
        }
      } catch (error) {
        console.warn(`   ⚠️  Could not read file ${filePath}`);
      }
    }

    if (tasks.length === 0) {
      tasks.push({
        description: context.commitMessage.replace(/^\[AI\]\s*/i, '').trim(),
        files: context.files,
        type: 'general'
      });
    }

    return tasks;
  }

  private extractTasksFromMarkdown(content: string, filePath: string): Task[] {
    const tasks: Task[] = [];
    
    const taskPattern = /^[-*]\s*\[[ ]\]\s*(.+)$/gm;
    const matches = content.matchAll(taskPattern);

    for (const match of matches) {
      tasks.push({
        description: match[1].trim(),
        files: [filePath],
        type: 'markdown',
        context: content
      });
    }

    const sectionPattern = /##\s*AI\s*Tasks?\s*\n([\s\S]*?)(?=\n##|\n$|$)/i;
    const sectionMatch = content.match(sectionPattern);
    
    if (sectionMatch) {
      const lines = sectionMatch[1].split('\n').filter(Boolean);
      for (const line of lines) {
        const taskMatch = line.match(/^[-*]\s*(.+)$/);
        if (taskMatch && !tasks.some(t => t.description === taskMatch[1].trim())) {
          tasks.push({
            description: taskMatch[1].trim(),
            files: [filePath],
            type: 'markdown',
            context: content
          });
        }
      }
    }

    return tasks;
  }

  private extractTasksFromCode(content: string, filePath: string): Task[] {
    const tasks: Task[] = [];
    
    const patterns = [
      /\/\/\s*AI:\s*(.+)$/gm,
      /\/\*\s*AI:\s*(.+?)\s*\*\//gs,
      /#\s*AI:\s*(.+)$/gm
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        tasks.push({
          description: match[1].trim(),
          files: [filePath],
          type: 'code-comment',
          context: content
        });
      }
    }

    return tasks;
  }

  private async createMergeRequest(
    git: SimpleGit,
    branchName: string,
    context: CommitContext,
    results: TaskResult[]
  ) {
    await git.push('origin', branchName, ['--set-upstream']);
    this.logger.log('info', `📤 Pushed branch: ${branchName}`);

    const affectedPackages = [...new Set(results.flatMap(r => r.affectedPackages))];
    
    this.logger.log('info', `🔀 Merge Request should be created:`);
    this.logger.log('info', `   Source: ${branchName}`);
    this.logger.log('info', `   Target: ${context.baseBranch}`);
    this.logger.log('info', `   Tasks: ${results.length}`);
    this.logger.log('info', `   Packages: ${affectedPackages.join(', ') || 'none'}`);
  }
}