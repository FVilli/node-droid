import { Injectable } from '@nestjs/common';
import { LLMClientService } from './llm-client.service';
import { LLMProfileResolverService } from './llm-profile-resolver.service';
import { RepoContextService } from './repo-context.service';
import { Task } from '../types';

@Injectable()
export class TranslateToEnglishService {
  constructor(
    private readonly llm: LLMClientService,
    private readonly llmProfileResolver: LLMProfileResolverService,
    private readonly repoContext: RepoContextService,
  ) {}

  async translateTasks(tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      const translated = await this.translateTask(task.title, task.description || '');
      task.title = translated.title;
      task.description = translated.description;
    }
  }

  private async translateTask(title: string, description: string): Promise<{ title: string; description: string }> {
    const profile = this.llmProfileResolver.resolve(this.repoContext.get());
    const messages = [
      {
        role: 'system',
        content: [
          'You are a translation engine.',
          'Translate the given task title and description to English.',
          'Preserve code blocks, inline code, file paths, identifiers, and punctuation exactly.',
          'Return only a JSON object with keys "title" and "description".',
          'If the description is empty, return an empty string.',
        ].join(' ')
      },
      { role: 'user', content: JSON.stringify({ title, description }, null, 2) }
    ];

    const response = await this.llm.chat(messages, profile);
    const content = response?.choices?.[0]?.message?.content;
    const parsed = this.safeJsonParse(content);
    if (!parsed) return { title, description };
    return {
      title: typeof parsed.title === 'string' ? parsed.title : title,
      description: typeof parsed.description === 'string' ? parsed.description : description
    };
  }

  private safeJsonParse(content: any): any | null {
    if (typeof content !== 'string') return null;
    const trimmed = content.trim();
    const withoutFence = trimmed
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '');
    try {
      return JSON.parse(withoutFence);
    } catch {
      return null;
    }
  }
}
