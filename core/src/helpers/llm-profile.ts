import { ENV } from '../env';
import { LLMProfile, RepoContext } from '../types';

export class LLMProfileHelper {
  static resolve(ctx: RepoContext): LLMProfile {
    const o = ctx.llmProfile || {};
    return {
      provider: 'openai-compatible',
      baseUrl: o.baseUrl || ENV.LLM_API_URL,
      apiKey: o.apiKey || ENV.LLM_API_KEY,
      model: o.model || ENV.LLM_MODEL,
      temperature: o.temperature ?? ENV.LLM_TEMPERATURE,
      maxTokens: o.maxTokens ?? ENV.LLM_MAX_TOKENS,
    };
  }
}
