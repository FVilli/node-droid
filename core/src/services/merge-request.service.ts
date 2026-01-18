import { Injectable } from '@nestjs/common';
import { ENV } from '../env';
import { RunLoggerService } from './run-logger.service';

@Injectable()
export class MergeRequestService {
  constructor(private readonly logger: RunLoggerService) {}

  async create({ branch, runId }: { branch: string; runId: string }) {
    if (ENV.NO_REMOTE_SIDE_EFFECTS) {
      this.logger.info(`[DRY] Would create MR for branch ${branch} (run ${runId})`);
      return;
    }

    // TODO: implementazione reale (GitHub/GitLab/Bitbucket)
    this.logger.info(`Creating MR for ${branch} (run ${runId})`);
  }
}
