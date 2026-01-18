import { Injectable } from '@nestjs/common';
import * as path from 'path';
import { ENV } from '../env';
import { RepoContext, RepoDescriptor } from '../interfaces';

@Injectable()
export class RepoContextService {
  private ctx?: RepoContext;

  setRepo(descriptor: RepoDescriptor, llmProfile: any): RepoContext {
    const rootPath = descriptor.path;
    const codePath = path.join(rootPath, ENV.REPO_CODE_FOLDER);
    const aiPath = path.join(rootPath, ENV.REPO_AI_FOLDER);
    const sshPath = path.join(rootPath, ENV.REPO_SSH_FOLDER);

    this.ctx = {
      id: descriptor.id,
      rootPath, codePath, aiPath, sshPath,
      remote: descriptor.config.remote,
      baseBranch: descriptor.config.baseBranch,
      buildCommand: descriptor.config.buildCommand || ENV.BUILD_COMMAND,
      llmProfile,
      agentPolicy: descriptor.config.agent || {},
    };
    return this.ctx;
  }

  get(): RepoContext { if (!this.ctx) throw new Error('RepoContext not set'); return this.ctx; }
  clear() { this.ctx = undefined; }
}
