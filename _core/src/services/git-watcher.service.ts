// packages/core/src/services/git-watcher.service.ts

import { Injectable, OnModuleInit } from '@nestjs/common';
import { CommitProcessorService } from './commit-processor.service';
import { MonorepoManagerService } from './monorepo-manager.service';
import { ConfigService } from './config.service';
import { RepoManagerService } from './repo-manager.service';
import { RepositoryConfig } from '../interfaces';
import { ENV } from 'src/env';
import { delay } from 'rxjs/internal/operators/delay';

@Injectable()
export class GitWatcherService {

  private watchInterval: NodeJS.Timeout;
  private working: boolean = false;

  constructor(
    private commitProcessor: CommitProcessorService,
    private monorepo: MonorepoManagerService,
    private config: ConfigService,
    private repoManager: RepoManagerService
  ) {}

  async start() {

    this.watchInterval = setInterval(async () => {
        this.working = true;
        await this.config.refresh();
        const repositories = this.config.getRepositories();
        console.log(`\n🚀 Start watch for ${repositories.length} repository(ies):`);
        for (const repo of repositories) {
            try {
                const watchBranch = this.config.getWatchBranch(repo);
                console.log(`\n📁 Repo:${repo.name} Branch: ${watchBranch}`);
                await this.repoManager.initializeRepository(repo);
                await this.processNewCommits(repo);
            } catch (error) {
                console.error(`❌ Error checking ${repo.name}:`, error.message);
            }
        }
        this.working = false;
    },ENV.WATCH_INTERVAL);

    console.log('\n' + '='.repeat(80));
    console.log('node-droid is now running. Waiting for [AI] commits...');
    console.log('='.repeat(80) + '\n');
  }

  async stop() {
    console.log('\n🛑 Stopping ...');
    clearInterval(this.watchInterval);
    while(this.working) await delay(3000);
    console.log(`✅ Stopped successfully.`);
  }

  private async processNewCommits(repo: RepositoryConfig) {
    const git = this.repoManager.getGit(repo.name);
    if (!git) {
      console.error(`❌ Git instance not found for ${repo.name}`);
      return;
    }

    const lastCommit = this.repoManager.getLastProcessedCommit(repo.name);
    if (!lastCommit) {
      console.warn(`⚠️  No last commit found for ${repo.name}, skipping check`);
      return;
    }

    await git.fetch();

    const watchBranch = this.config.getWatchBranch(repo);
    const log = await git.log([`${lastCommit}..origin/${watchBranch}`]);

    if (log.all.length === 0) return;

    console.log(`\n📬 [${repo.name}] Found ${log.all.length} new commit(s)`);

    // Processa i commit in ordine cronologico
    for (const commit of log.all.reverse()) {
      await this.processCommit(repo, commit);
      this.repoManager.setLastProcessedCommit(repo.name, commit.hash);
    }
  }

  private async processCommit(repo: RepositoryConfig, commit: any) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 [${repo.name}] Analyzing commit: ${commit.hash.substring(0, 7)}`);
    console.log(`   Author: ${commit.author_name}`);
    console.log(`   Date: ${commit.date}`);
    console.log(`   Message: ${commit.message}`);

    // Verifica se il commit interpella l'AI
    if (!this.isAICommit(commit.message)) {
      console.log('   ⏭️  Skipping (not an AI commit)');
      console.log('='.repeat(80));
      return;
    }

    console.log('   🤖 AI commit detected!');

    const git = this.repoManager.getGit(repo.name);
    if (!git) return;

    // Checkout del commit per analizzare i file
    await git.checkout(commit.hash);

    // Ottieni i file modificati
    const diff = await git.diff([
      `${commit.hash}^`,
      commit.hash,
      '--name-only'
    ]);
    
    const files = diff.split('\n').filter(Boolean);
    console.log(`   📁 Files changed: ${files.length}`);
    files.forEach(file => console.log(`      - ${file}`));

    // Processa il commit con il path del repository specifico
    await this.commitProcessor.process({
      commitHash: commit.hash,
      commitMessage: commit.message,
      files,
      baseBranch: this.config.getWatchBranch(repo)
    }, repo);

    // Torna al branch di watch
    const watchBranch = this.config.getWatchBranch(repo);
    await git.checkout(watchBranch);
    
    console.log('='.repeat(80));
  }

  private isAICommit(message: string): boolean {
    return /^\[AI\]|\@AI|^\[ai\]/i.test(message.trim());
  }
}