import { LLMProfile } from '../types';

export class LLMRequests {
  static buildChatUrl(profile: LLMProfile): string {
    return `${profile.baseUrl}/chat/completions`;
  }

  static buildHeaders(profile: LLMProfile): Record<string, string> {
    return { Authorization: `Bearer ${profile.apiKey}` };
  }

  static buildChatPayload(messages: any[], profile: LLMProfile, tools?: any[]) {
    return {
      model: profile.model,
      temperature: profile.temperature,
      max_tokens: profile.maxTokens,
      messages,
      tools,
      tool_choice: tools && tools.length ? 'auto' : undefined
    };
  }
}
