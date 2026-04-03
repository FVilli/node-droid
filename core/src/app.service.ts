import { BeforeApplicationShutdown, Injectable } from '@nestjs/common';
import { RunStateService } from './services/run-state.service';
import { WorkspaceService } from './services/workspace.service';
import { RunLoggerService } from './services/run-logger.service';
import { Cron } from '@nestjs/schedule';
import { RunOrchestratorService } from './services/run-orchestrator.service';

@Injectable()
export class AppService implements BeforeApplicationShutdown {

  private isShuttingDown = false;
  private isWorking = false;

  constructor(
    private readonly runState: RunStateService,
    private readonly workspace: WorkspaceService,
    private readonly logger: RunLoggerService,
    private readonly runOrchestrator: RunOrchestratorService,
  ) {}
 
  async beforeApplicationShutdown(signal: string) {
    this.logger.warn(`Shutdown requested (${signal})`);
    this.isShuttingDown = true;
    this.runState.setShuttingDown(true);
  }

  @Cron('0 * * * * *')
  private async tick() {
    if (this.isShuttingDown) return;
    if (this.isWorking) return;
    this.isWorking = true;
    try {
      const repos = this.workspace.listRepos();
      this.logger.scanRepos(repos.length);
      if (!repos.length || this.isShuttingDown) return;

      for (const repo of repos) {
        const shouldContinue = await this.runOrchestrator.runRepo(repo, this.isShuttingDown);
        if (!shouldContinue) return;
      }
      this.logger.event('🐧', 'Waiting next tick ...');
    } catch (err: any) {
      this.logger.error(`[node-droid] fatal error: ${err?.message || err}`);
    } finally {
      this.isWorking = false;
    }
  }
}
