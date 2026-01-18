// packages/core/src/services/repository-manager.service.ts

import { Injectable } from '@nestjs/common';
import simpleGit, { SimpleGit } from 'simple-git';
import { RepositoryConfig } from '../interfaces';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getRepoPath } from 'src/utils';

const execAsync = promisify(exec);

@Injectable()
export class RepoManagerService {
  private git:SimpleGit;
  private lastProcessedCommits: Map<string, string> = new Map();

  async initializeRepository(repo: RepositoryConfig): Promise<void> {
    const repoPath = getRepoPath(repo.name);
    console.log(`\n📁 Initializing repository: ${repo.name}`);
    console.log(`   Path: ${repoPath}`);

    // Verifica se la directory esiste
    try {
      await fs.access(repoPath);
    } catch {
      // Directory non esiste, prova a clonarla se c'è un remote
      if (repo.gitRemote) {
        console.log(`   📥 Cloning from ${repo.gitRemote}...`);
        await this.cloneRepository(repo, repoPath);
      } else {
        throw new Error(`Repository path does not exist and no remote URL provided: ${repo.path}`);
      }
    }

    // Crea istanza git
    this.git = simpleGit(repoPath);

    // Configura SSH se necessario
    if (repo.sshKeyPath) {
      process.env.GIT_SSH_COMMAND = `ssh -i ${repo.sshKeyPath} -o StrictHostKeyChecking=no`;
    }

    // Fetch e ottieni ultimo commit
    try {
      await this.git.fetch();
      const watchBranch = repo.watchBranch || 'main';
      const log = await this.git.log([watchBranch, '-1']);
      
      if (log.latest) {
        this.lastProcessedCommits.set(repo.name, log.latest.hash);
        console.log(`   ✅ Initialized at commit: ${log.latest.hash.substring(0, 7)}`);
      }
    } catch (error) {
      console.warn(`   ⚠️  Could not fetch repository: ${error.message}`);
    }
  }

  private async cloneRepository(repo: RepositoryConfig, repoPath:string): Promise<void> {
    const sshCommand = repo.sshKeyPath ? `GIT_SSH_COMMAND='ssh -i ${repo.sshKeyPath} -o StrictHostKeyChecking=no'` : '';
    await execAsync(`${sshCommand} git clone ${repo.gitRemote} ${repoPath}`);
  }

  getLastProcessedCommit(repoName: string): string | undefined {
    return this.lastProcessedCommits.get(repoName);
  }

  setLastProcessedCommit(repoName: string, commitHash: string): void {
    this.lastProcessedCommits.set(repoName, commitHash);
  }

  getAllRepositories(): string[] {
    return Array.from(this.gitInstances.keys());
  }
}