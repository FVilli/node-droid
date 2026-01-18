import { Injectable } from '@nestjs/common';
import { execSync } from 'child_process';
import { RepoContextService } from './repo-context.service';
import { BuildResult } from '../interfaces';
import { ENV } from '../env';

@Injectable()
export class BuildService {

  constructor(private readonly repoContext: RepoContextService) {}

  private _run(cmd: string) {
    const { codePath } = this.repoContext.get();
    return execSync(cmd, { cwd: codePath, stdio: 'pipe', encoding: 'utf-8', shell: '/bin/bash' });
  }

  npmInstall() {
    return this._run('npm i');
  }

  async run(BUILD_CMD: string): Promise<BuildResult> {
    const start = Date.now();
    try {
      const stdout = this._run(BUILD_CMD);
      return { success: true, exitCode: 0, stdout, stderr: '', durationMs: Date.now() - start };
    } catch (err: any) {
      return { success: false, exitCode: err.status || 1, stdout: err.stdout?.toString() || '', stderr: err.stderr?.toString() || '', durationMs: Date.now() - start };
    }
  }

}
