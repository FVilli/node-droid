// app.module.ts (aggiornato)
import { Module } from '@nestjs/common';
import { GitWatcherService } from './services/git-watcher.service';
import { CommitProcessorService } from './services/commit-processor.service';
import { AIAgentService } from './services/ai-agent.service';
import { MonorepoManagerService } from './services/monorepo-manager.service';
import { AIActivityLoggerService } from './services/ai-activity-logger.service';
import { RepomixService } from './services/repomix.service';
import { ConfigService } from './services/config.service';
import { RepoManagerService } from './services/repo-manager.service';

@Module({
  providers: [
    GitWatcherService,
    CommitProcessorService,
    AIAgentService,
    RepoManagerService,
    MonorepoManagerService,
    AIActivityLoggerService,
    RepomixService,
    ConfigService,
  ]
})
export class AppModule {}