import * as path from 'path';
import { ENV } from '../env';
import { RepoContext, RepoDescriptor } from '../types';

export class RepoContextBuilder {
  static build(descriptor: RepoDescriptor, llmProfile: any): RepoContext {
    const rootPath = descriptor.path;
    const codePath = path.join(rootPath, ENV.REPO_CODE_FOLDER);
    const aiPath = path.join(codePath, ENV.REPO_AI_FOLDER);
    const sshPath = path.join(rootPath, ENV.REPO_SSH_FOLDER);

    return {
      id: descriptor.id,
      rootPath,
      codePath,
      aiPath,
      sshPath,
      remote: descriptor.config.remote,
      baseBranch: descriptor.config.baseBranch,
      buildCommand: descriptor.config.buildCommand || ENV.BUILD_COMMAND,
      llmProfile,
      agentPolicy: descriptor.config.agent || {},
      repomix: descriptor.config.repomix || {},
    };
  }
}
