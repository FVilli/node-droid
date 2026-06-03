import { Injectable } from '@nestjs/common';
import { GitService } from './git.service';
import { RunLoggerService } from './run-logger.service';

@Injectable()
export class MergeRequestService {
  constructor(
    private readonly git: GitService,
    private readonly logger: RunLoggerService,
  ) {}

  async create(
    baseBranch: string,
    branch: string,
    runId: string,
    token?: string,
  ): Promise<string> {
    const title = `AI Automation Run ${runId}`;
    const body = this.logger.getPrSummary();
    return (
      await this.git.createPR(baseBranch, branch, title, body, token)
    ).trim();
  }
}
