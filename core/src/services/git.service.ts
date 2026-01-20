import { Injectable } from '@nestjs/common';
import { ENV } from '../env';
import { GitRemoteUpdates } from '../interfaces';
import { extractTag, normalizeCommits, normalizeGitFiles, splitPipe } from '../libs/utils';
import { RunLoggerService } from './run-logger.service';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { RepoContextService } from './repo-context.service';

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
    this.runRoot(`git clone ${remote} code`);
  }

  checkout(branch: string) {
    this.logger.info(`git checkout ${branch}`);
    this.run(`git checkout ${branch}`);
  }

  fetch() {
    this.logger.info('git fetch origin');
    this.run(`git fetch origin`);
  }

  createBranch(branch: string) {
    this.logger.info(`git checkout -b ${branch}`);
    this.run(`git checkout -b ${branch}`);
  }

  commit(msg: string) {
    this.logger.info(`git commit -am "${msg}"`);
    this.run(`git add -A && git commit -m "${msg}"`);
  }

  pull(branch: string) {
    this.logger.info(`git pull origin ${branch}`);
    this.run(`git pull origin ${branch}`);
  }

  push(branch: string) {
    if (ENV.NO_REMOTE_SIDE_EFFECTS) {
      this.logger.info(`[DRY] Would push ${branch}`);
      return;
    }
    this.logger.info(`git push origin ${branch}`);
    this.run(`git push origin ${branch}`);
  }

  // --- robust remote delta (tag-based) ---

  getLastCommits(baseBranch: string): GitRemoteUpdates {
    const cmd = `
      git checkout ${baseBranch} 2>/dev/null && git fetch origin 2>/dev/null && {
        echo "<RESULT>";
        echo "<BRANCH>$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'error')</BRANCH>";
        echo "<COMMITS>$(git log --oneline HEAD..origin/${baseBranch} 2>/dev/null | tr '\\n' '|' | sed 's/|$//')</COMMITS>";
        echo "<FILES>$(git diff --name-status HEAD origin/${baseBranch} 2>/dev/null | tr '\\n' '|' | sed 's/|$//')</FILES>";
        echo "</RESULT>";
      } 2>/dev/null || echo "<RESULT><ERROR>Impossibile completare l'operazione</ERROR></RESULT>"
    `;
    const out = this.run(cmd.replace(/\s+/g, ' ').trim());
    const branch = extractTag(out, 'BRANCH');
    const commits = normalizeCommits(splitPipe(extractTag(out, 'COMMITS')));
    const files = normalizeGitFiles(splitPipe(extractTag(out, 'FILES')));
    const error = extractTag(out, 'ERROR');
    return { branch: branch || '', commits, files, error: error || undefined };
  }

  createPR(baseBranch: string, branch: string, title: string, body: string, token?: string) {
    let cmd = `gh pr create --title "${title}" --body "${body}" --base ${baseBranch} --head ${branch}`;
    if (token) cmd = `export GH_TOKEN="${token}" && ` + cmd;
    const rv = this.run(cmd);
    console.log(rv);
    return rv;
  }
}
