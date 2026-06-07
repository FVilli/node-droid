import { Injectable } from '@nestjs/common';
import { execSync } from 'child_process';
import { RepoContextService } from './repo-context.service';
import { BuildResult } from '../types';
import { BuildHelpers } from '../helpers/build-helpers';
import * as fs from 'fs';
import * as path from 'path';
import { RunLoggerService } from './run-logger.service';

@Injectable()
export class BuildService {
  constructor(
    private readonly repoContext: RepoContextService,
    private readonly logger: RunLoggerService,
  ) {}

  private runInDir(cmd: string, cwd: string) {
    return execSync(cmd, {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8',
      shell: '/bin/bash',
    });
  }

  build(): Promise<BuildResult> {
    return this.buildPackageDir('.');
  }

  async buildPackageDirs(
    packageDirs: string[],
    installPackageDirs: string[] = [],
  ): Promise<BuildResult> {
    const start = Date.now();
    let combinedStdout = '';
    let builtCount = 0;
    let skippedCount = 0;
    const installDirs = new Set(installPackageDirs);

    for (const dir of packageDirs) {
      const full = path.resolve(this.repoContext.get().codePath, dir);
      if (!this.hasBuildScript(full)) {
        skippedCount++;
        const message = `[${dir}] install/build skipped: no package.json scripts.build`;
        combinedStdout += `\n${message}\n`;
        this.logger.event(
          '⏭️',
          `Install/build skipped [${dir}] (no build script)`,
        );
        continue;
      }

      if (installDirs.has(dir)) {
        const installCmd = this.getInstallCommand(full);
        this.logger.event('📦', `Install [${dir}] (${installCmd})`);
        try {
          const out = this.runInDir(installCmd, full);
          combinedStdout += `\n[${dir}] ${installCmd}\n${out}`;
          this.logger.event('✅', `Install [${dir}] OK`);
        } catch (err: any) {
          this.logger.event('⚠️', `Install [${dir}] FAIL`, 'WARN');
          return BuildHelpers.buildFailure(
            start,
            this.wrapCommandError(err, dir, installCmd),
          );
        }
      }

      try {
        const buildCmd = 'npm run build';
        this.logger.event('🏗️', `Build [${dir}] (${buildCmd})`);
        const out = this.runInDir(buildCmd, full);
        combinedStdout += `\n[${dir}] ${buildCmd}\n${out}`;
        builtCount++;
        this.logger.event('✅', `Build [${dir}] OK`);
      } catch (err: any) {
        this.logger.event('⚠️', `Build [${dir}] FAIL`, 'WARN');
        return BuildHelpers.buildFailure(
          start,
          this.wrapCommandError(err, dir, 'npm run build'),
        );
      }
    }

    if (!builtCount && skippedCount) {
      this.logger.event('⏭️', 'Build gate skipped: no build scripts found');
    }

    return BuildHelpers.buildSuccess(start, combinedStdout);
  }

  private async buildPackageDir(dir: string): Promise<BuildResult> {
    const start = Date.now();
    const full = path.resolve(this.repoContext.get().codePath, dir);
    if (!this.hasBuildScript(full)) {
      const message = `[${dir}] build skipped: no package.json scripts.build`;
      this.logger.event('⏭️', `Build skipped [${dir}] (no build script)`);
      return BuildHelpers.buildSuccess(start, `${message}\n`);
    }

    try {
      const stdout = this.runInDir('npm run build', full);
      return BuildHelpers.buildSuccess(start, stdout);
    } catch (err: any) {
      return BuildHelpers.buildFailure(start, err);
    }
  }

  private hasBuildScript(dir: string): boolean {
    return this.hasScript(dir, 'build');
  }

  private getInstallCommand(dir: string): string {
    return this.hasScript(dir, 'install') ? 'npm run install' : 'npm i';
  }

  private hasScript(dir: string, scriptName: string): boolean {
    const pkgPath = path.join(dir, 'package.json');
    try {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const json = JSON.parse(raw);
      return typeof json?.scripts?.[scriptName] === 'string';
    } catch {
      return false;
    }
  }

  private wrapCommandError(err: any, dir: string, cmd: string) {
    const prefix = `[${dir}] ${cmd}\n`;
    return {
      status: err?.status || 1,
      stdout: prefix + (err?.stdout?.toString() || ''),
      stderr: prefix + (err?.stderr?.toString() || ''),
    };
  }
}
