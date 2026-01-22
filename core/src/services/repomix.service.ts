import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { RepoContextService } from './repo-context.service';
import { RepomixConfig, Task } from '../types';
import { RunLoggerService } from './run-logger.service';
import { RepomixHelpers } from '../helpers/repomix-helpers';

const execAsync = promisify(exec);

@Injectable()
export class RepomixService {
  private isAvailable?: boolean;
  private cachedContext?: string;
  private cachedAt?: number;
  private readonly cacheMs = 5 * 60 * 1000;

  constructor(
    private readonly repoContext: RepoContextService,
    private readonly logger: RunLoggerService,
  ) {}

  async getSmartProjectContext(task: Task): Promise<string | null> {
    const cfg = this.getConfig();
    if (cfg.enabled !== true) return null;
    await this.ensureAvailability();
    if (!this.isAvailable) {
      this.logger.warn('Repomix enabled but not installed. Add `repomix` to devDependencies and run `npm i -D repomix`.');
      return null;
    }

    const related = RepomixHelpers.getRelatedFiles(task);
    if (related.length > 0 && related.length < 20) {
      const focused = await this.generateContext(related, 'focused', cfg);
      if (focused && focused.length <= RepomixHelpers.getMaxContextSize(cfg)) return focused;
    }

    const full = await this.getCachedOrGenerate();
    if (!full) return null;
    if (full.length <= RepomixHelpers.getMaxContextSize(cfg)) return full;
    return `${full.slice(0, RepomixHelpers.getMaxContextSize(cfg))}\n\n... [context truncated]`;
  }

  private async ensureAvailability(): Promise<void> {
    if (this.isAvailable !== undefined) return;
    try {
      const { codePath } = this.repoContext.get();
      const packageJsonPath = path.join(codePath, 'package.json');
      const raw = await fs.readFile(packageJsonPath, 'utf-8').catch(() => '');
      const pkg = raw ? JSON.parse(raw) : {};
      const hasDep = !!(pkg?.devDependencies?.repomix || pkg?.dependencies?.repomix);
      this.isAvailable = hasDep;
    } catch {
      this.isAvailable = false;
    }
  }

  private async getCachedOrGenerate(): Promise<string | null> {
    const now = Date.now();
    if (this.cachedContext && this.cachedAt && now - this.cachedAt < this.cacheMs) {
      return this.cachedContext;
    }

    const context = await this.generateContext(null, 'full', this.getConfig());
    if (context) {
      this.cachedContext = context;
      this.cachedAt = now;
    }
    return context;
  }

  private async generateContext(
    relatedFiles: string[] | null,
    kind: 'full' | 'focused',
    cfg: RepomixConfig
  ): Promise<string | null> {
    const { codePath, aiPath } = this.repoContext.get();
    const tempDir = path.join(aiPath, 'repomix');
    await fs.mkdir(tempDir, { recursive: true });

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const outputPath = path.join(tempDir, `repomix-${kind}-${stamp}.md`);
    const configPath = path.join(tempDir, `repomix-${kind}-${stamp}.config.json`);

    const config: any = RepomixHelpers.buildConfig(cfg, outputPath, relatedFiles);

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    try {
      await execAsync(
        `npx repomix ${codePath} --config ${configPath} --output ${outputPath}`,
        { cwd: process.cwd(), timeout: 30000 }
      );
      return await fs.readFile(outputPath, 'utf-8');
    } catch {
      return null;
    } finally {
      await fs.unlink(outputPath).catch(() => {});
      await fs.unlink(configPath).catch(() => {});
    }
  }

  private getConfig(): RepomixConfig {
    const cfg = this.repoContext.get().repomix || {};
    return cfg;
  }

}
