import { Injectable } from '@nestjs/common';
import { execSync } from 'child_process';
import { RepoContextService } from './repo-context.service';
import { BuildResult } from '../types';
import { ENV } from '../env';
import { BuildHelpers } from '../helpers/build-helpers';
import * as fs from 'fs';
import * as path from 'path';
import { RunLoggerService } from './run-logger.service';

@Injectable()
export class ScriptsService {

  constructor(
    private readonly repoContext: RepoContextService,
    private readonly logger: RunLoggerService,
  ) {}

  private _run(cmd: string) {
    const { codePath } = this.repoContext.get();
    return execSync(cmd, { cwd: codePath, stdio: 'pipe', encoding: 'utf-8', shell: '/bin/bash' });
  }

  private runInDir(cmd: string, cwd: string) {
    return execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf-8', shell: '/bin/bash' });
  }

  npmInstall() {
    return this._run(ENV.INSTALL_CMD);
  }

  build(): Promise<BuildResult> {
    return this.run(ENV.BUILD_CMD);
  }

  async installAndBuildPackages(packageDirs: string[]): Promise<BuildResult> {
    const start = Date.now();
    let combinedStdout = '';
    for (const dir of packageDirs) {
      const full = path.resolve(this.repoContext.get().codePath, dir);
      const installCmd = this.getInstallCommand(full);
      this.logger.event('📦', `Install [${dir}] (${installCmd})`);
      try {
        const out = this.runInDir(installCmd, full);
        combinedStdout += `\n[${dir}] ${installCmd}\n${out}`;
        this.logger.event('✅', `Install [${dir}] OK`);
      } catch (err: any) {
        this.logger.event('⚠️', `Install [${dir}] FAIL`, 'WARN');
        return BuildHelpers.buildFailure(start, this.wrapCommandError(err, dir, installCmd));
      }

      try {
        const buildCmd = 'npm run build';
        this.logger.event('🏗️', `Build [${dir}] (${buildCmd})`);
        const out = this.runInDir(buildCmd, full);
        combinedStdout += `\n[${dir}] ${buildCmd}\n${out}`;
        this.logger.event('✅', `Build [${dir}] OK`);
      } catch (err: any) {
        this.logger.event('⚠️', `Build [${dir}] FAIL`, 'WARN');
        return BuildHelpers.buildFailure(start, this.wrapCommandError(err, dir, 'npm run build'));
      }
    }
    return BuildHelpers.buildSuccess(start, combinedStdout);
  }

  private async run(BUILD_CMD: string): Promise<BuildResult> {
    const start = Date.now();
    try {
      const stdout = this._run(BUILD_CMD);
      return BuildHelpers.buildSuccess(start, stdout);
    } catch (err: any) {
      return BuildHelpers.buildFailure(start, err);
    }
  }

  private getInstallCommand(dir: string): string {
    const pkgPath = path.join(dir, 'package.json');
    try {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const json = JSON.parse(raw);
      if (json?.scripts?.install) return 'npm run install';
    } catch {
      return 'npm install';
    }
    return 'npm install';
  }

  private wrapCommandError(err: any, dir: string, cmd: string) {
    const prefix = `[${dir}] ${cmd}\n`;
    return {
      status: err?.status || 1,
      stdout: prefix + (err?.stdout?.toString() || ''),
      stderr: prefix + (err?.stderr?.toString() || '')
    };
  }

}
