import { Injectable } from '@nestjs/common';
import { execSync } from 'child_process';
import { RepoContextService } from './repo-context.service';
import { BuildResult } from '../types';
import { ENV } from '../env';
import { BuildHelpers } from '../helpers/build-helpers';

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
      return BuildHelpers.buildSuccess(start, stdout);
    } catch (err: any) {
      return BuildHelpers.buildFailure(start, err);
    }
  }

}
