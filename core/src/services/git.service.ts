import { Injectable } from '@nestjs/common';
import { ENV } from '../env';
import { GitRemoteUpdates } from '../types';
import { RunLoggerService } from './run-logger.service';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { RepoContextService } from './repo-context.service';
import { GitHelpers } from '../helpers/git-helpers';
import { GitCommands } from '../helpers/git-commands';

@Injectable()
export class GitService {

  constructor(
    private readonly logger: RunLoggerService,
    private readonly repoContext: RepoContextService,
  ) {}

  // --- helpers ---
  private run(cmd: string) {
    const { codePath } = this.repoContext.get();
    //console.log(`[EXEC] ${cmd} (in ${codePath})`);
    const rv = execSync(cmd, { cwd: codePath, stdio: 'pipe', encoding: 'utf-8', shell: '/bin/bash' }).trim();
    //console.log(rv);
    return rv;
  }

  private runRoot(cmd: string) {
    const { rootPath } = this.repoContext.get();
    return execSync(cmd, { cwd: rootPath, stdio: 'pipe', encoding: 'utf-8', shell: '/bin/bash' }).trim();
  }

  // --- lifecycle ---

  ensureCloned(remote: string) {
    const { codePath, rootPath } = this.repoContext.get();
    if (fs.existsSync(codePath)) return;
    fs.mkdirSync(rootPath, { recursive: true });
    this.logger.info(`Cloning ${remote}`);
    this.runRoot(GitCommands.clone(remote));
  }

  checkout(branch: string) {
    this.logger.info(`git checkout ${branch}`);
    this.run(GitCommands.checkout(branch));
  }

  fetch() {
    this.logger.info('git fetch origin');
    this.run(GitCommands.fetch());
  }

  createBranch(branch: string) {
    this.logger.info(`git checkout -b ${branch}`);
    this.run(GitCommands.createBranch(branch));
  }

  commit(msg: string) {
    this.logger.info(`git commit -am "${msg}"`);
    this.run(GitCommands.commit(msg));
  }

  pull(branch: string) {
    this.logger.info(`git pull origin ${branch}`);
    this.run(GitCommands.pull(branch));
  }

  push(branch: string) {
    if (ENV.NO_REMOTE_SIDE_EFFECTS) {
      this.logger.info(`[DRY] Would push ${branch}`);
      return;
    }
    this.logger.info(`git push origin ${branch}`);
    this.run(GitCommands.push(branch));
  }

  // --- robust remote delta (tag-based) ---

  getLastCommits(baseBranch: string): GitRemoteUpdates {
    const cmd = GitHelpers.buildRemoteDeltaCommand(baseBranch);
    const out = this.run(cmd);
    return GitHelpers.parseRemoteDelta(out);
  }

  createPR(baseBranch: string, branch: string, title: string, body: string, token?: string) {
    const rv = this.run(GitCommands.createPr(baseBranch, branch, title, body, token));
    console.log(rv);
    return rv;
  }

  getHeadSha(): string {
    return this.run('git rev-parse --short HEAD');
  }

  getHeadSubject(): string {
    return this.run('git log -1 --pretty=%s');
  }
}
