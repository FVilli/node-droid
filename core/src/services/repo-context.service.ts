import { Injectable } from '@nestjs/common';
import { RepoContext, RepoDescriptor } from '../types';
import { RepoContextBuilder } from '../helpers/repo-context-builder';

@Injectable()
export class RepoContextService {
  private ctx?: RepoContext;

  setRepo(descriptor: RepoDescriptor, llmProfile: any): RepoContext {
    this.ctx = RepoContextBuilder.build(descriptor, llmProfile);
    return this.ctx;
  }

  get(): RepoContext { if (!this.ctx) throw new Error('RepoContext not set'); return this.ctx; }
  clear() { this.ctx = undefined; }
}
