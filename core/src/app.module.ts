import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { RunStateService } from './services/run-state.service';
import { WorkspaceService } from './services/workspace.service';
import { RepoContextService } from './services/repo-context.service';
import { GitService } from './services/git.service';
import { TaskExtractionService } from './services/task-extraction.service';
import { TaskNormalizationService } from './services/task-normalization.service';
import { TaskQueueService } from './services/task-queue.service';
import { TaskExecutorService } from './services/task-executor.service';
import { ToolRegistryService } from './services/tool-registry.service';
import { FileSystemToolService } from './services/filesystem-tool.service';
import { LLMClientService } from './services/llm-client.service';
import { LLMProfileResolverService } from './services/llm-profile-resolver.service';
import { PromptTemplateService } from './services/prompt-template.service';
import { PromptService } from './services/prompt.service';
import { ContextFileService } from './services/context-file.service';
import { BuildService } from './services/build.service';
import { RunLoggerService } from './services/run-logger.service';
import { AIInstructionsService } from './services/ai-instructions.service';
import { TranslateToEnglishService } from './services/translate-to-english.service';
import { ScheduleModule } from '@nestjs/schedule';
import { RunOrchestratorService } from './services/run-orchestrator.service';
import { MergeRequestService } from './services/merge-request.service';
import { AuditPublisherService } from './services/audit-publisher.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    AppService,
    RunStateService,
    WorkspaceService,
    RepoContextService,
    GitService,
    TaskExtractionService,
    TaskNormalizationService,
    TaskQueueService,
    TaskExecutorService,
    ToolRegistryService,
    FileSystemToolService,
    LLMClientService,
    LLMProfileResolverService,
    PromptTemplateService,
    PromptService,
    ContextFileService,
    BuildService,
    RunLoggerService,
    AuditPublisherService,
    RunOrchestratorService,
    MergeRequestService,
    AIInstructionsService,
    TranslateToEnglishService,
  ],
})
export class AppModule {}
