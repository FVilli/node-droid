import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LLMProfile } from '../interfaces';

@Injectable()
export class LLMClientService {

  async chat(messages: any[], profile?: LLMProfile, tools?: any[]): Promise<any> {
    if (!profile) throw new Error('LLM profile not set');
    const { baseUrl, apiKey, model, temperature, maxTokens } = profile;

    const res = await axios.post(`${baseUrl}/chat/completions`, {
      model,
      temperature,
      max_tokens: maxTokens,
      messages,
      tools,
      tool_choice: tools && tools.length ? 'auto' : undefined
    }, { headers: { Authorization: `Bearer ${apiKey}` } });

    return res.data;
  }

  async complete(prompt: string, profile?: LLMProfile, tools?: any[]): Promise<any> {
    return this.chat([{ role: 'user', content: prompt }], profile, tools);
  }
}
