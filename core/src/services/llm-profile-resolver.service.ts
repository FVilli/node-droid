import { Injectable } from '@nestjs/common';
import { RepoContext, LLMProfile } from '../types';
import { LLMProfileHelper } from '../helpers/llm-profile';

@Injectable()
export class LLMProfileResolverService {

  resolve(ctx: RepoContext): LLMProfile {
    return LLMProfileHelper.resolve(ctx);
  }
}
