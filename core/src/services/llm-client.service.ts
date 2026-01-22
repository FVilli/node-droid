import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LLMProfile } from '../types';
import { LLMRequests } from '../helpers/llm-requests';

@Injectable()
export class LLMClientService {

  async chat(messages: any[], profile?: LLMProfile, tools?: any[]): Promise<any> {
    if (!profile) throw new Error('LLM profile not set');
    const res = await axios.post(
      LLMRequests.buildChatUrl(profile),
      LLMRequests.buildChatPayload(messages, profile, tools),
      { headers: LLMRequests.buildHeaders(profile) }
    );

    return res.data;
  }

  async complete(prompt: string, profile?: LLMProfile, tools?: any[]): Promise<any> {
    return this.chat([{ role: 'user', content: prompt }], profile, tools);
  }
}
