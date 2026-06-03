import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';
import * as path from 'path';
import { Task } from '../types';
import { ENV } from '../env';
import { TaskParsers } from '../helpers/task-parsers';
import { LLMClientService } from './llm-client.service';
import { RepoContextService } from './repo-context.service';

interface ReviewedTask {
  title?: unknown;
  description?: unknown;
  line?: unknown;
  relatedFiles?: unknown;
}

@Injectable()
export class TaskExtractionService {
  constructor(
    private readonly llm: LLMClientService,
    private readonly repoContext: RepoContextService,
  ) {}

  async extractFromFile(file: string, content: string): Promise<Task[]> {
    const deterministic = this.extractDeterministic(file, content);
    if (!this.shouldReviewWithLLM(file)) return deterministic;
    if (ENV.NO_LLM) return deterministic;

    try {
      return await this.reviewWithLLM(file, content, deterministic);
    } catch {
      return deterministic;
    }
  }

  private extractDeterministic(file: string, content: string): Task[] {
    if (file.endsWith('.ts')) return TaskParsers.fromTS(file, content);
    if (file.endsWith(ENV.AI_TODO_FILE))
      return TaskParsers.fromMD(file, content);
    return [];
  }

  private shouldReviewWithLLM(file: string): boolean {
    return file.endsWith('.ts') || file.endsWith(ENV.AI_TODO_FILE);
  }

  private async reviewWithLLM(
    file: string,
    content: string,
    deterministic: Task[],
  ): Promise<Task[]> {
    const profile = this.repoContext.get().llmProfile;
    const response = await this.llm.chat(
      this.buildReviewMessages(file, content, deterministic),
      profile,
    );
    const reviewed = this.parseReviewedTasks(this.getMessageContent(response));
    if (!reviewed) return deterministic;
    return reviewed.map((task) => this.toTask(file, task));
  }

  private buildReviewMessages(
    file: string,
    content: string,
    deterministic: Task[],
  ): Array<{ role: string; content: string }> {
    const objective =
      'Estrarre i task espliciti che node-droid deve eseguire dal singolo file analizzato.';
    const rules = [
      `Nei file .ts un task e' dichiarato da un commento che contiene ${ENV.AI_TODO_COMMENT}.`,
      `Nei file ${ENV.AI_TODO_FILE} ogni bullet di primo livello rappresenta un task.`,
      'Le righe descrittive subito successive al marker o indentate sotto un bullet fanno parte della descrizione.',
      'Non inventare task impliciti: includi solo richieste esplicite presenti nel file.',
      'Se la procedura deterministica ha perso un task esplicito, aggiungilo.',
      'Se la procedura deterministica ha incluso un falso positivo, rimuovilo.',
      'Mantieni titoli e descrizioni fedeli al testo originale.',
      'Rispondi solo con JSON valido nel formato { "tasks": [...] }.',
      'Ogni task deve avere: title, description, line, relatedFiles.',
    ];

    const system = [
      'Sei un agente-controllore.',
      'Devi verificare il risultato di una procedura deterministica di estrazione task.',
      'Correggi solo il risultato dell estrazione; non eseguire i task.',
    ].join('\n');

    const user = [
      '## Obiettivo della procedura',
      objective,
      '',
      '## Regole della procedura',
      ...rules.map((rule) => `- ${rule}`),
      '',
      '## File analizzato',
      file,
      '',
      '```text',
      content,
      '```',
      '',
      '## Risultato deterministico',
      '```json',
      JSON.stringify(
        deterministic.map((task) => ({
          title: task.title,
          description: task.description,
          line: task.line,
          relatedFiles: task.relatedFiles,
        })),
        null,
        2,
      ),
      '```',
      '',
      'Controlla e restituisci il risultato corretto come solo JSON valido.',
    ].join('\n');

    return [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];
  }

  private getMessageContent(response: any): string {
    const content = response?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : '';
  }

  private parseReviewedTasks(content: string): ReviewedTask[] | null {
    const jsonText = this.extractJsonObject(content);
    if (!jsonText) return null;

    try {
      const parsed = JSON.parse(jsonText) as { tasks?: unknown };
      if (!Array.isArray(parsed.tasks)) return null;
      return parsed.tasks.filter(
        (task) => typeof task === 'object' && task !== null,
      ) as ReviewedTask[];
    } catch {
      return null;
    }
  }

  private extractJsonObject(content: string): string | null {
    const trimmed = content.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return trimmed.slice(start, end + 1);
  }

  private toTask(file: string, task: ReviewedTask): Task {
    return {
      id: nanoid(4),
      source: file.endsWith(ENV.AI_TODO_FILE) ? 'md' : 'ts',
      file,
      line: typeof task.line === 'number' ? task.line : undefined,
      title: typeof task.title === 'string' ? task.title.trim() : '',
      description:
        typeof task.description === 'string' ? task.description.trim() : '',
      relatedFiles: this.normalizeRelatedFiles(file, task.relatedFiles),
      status: 'TODO',
    };
  }

  private normalizeRelatedFiles(file: string, relatedFiles: unknown): string[] {
    if (Array.isArray(relatedFiles)) {
      const normalized = relatedFiles
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
      if (normalized.length) return normalized;
    }

    if (!file.endsWith(ENV.AI_TODO_FILE)) return [file];

    const dir = path.dirname(file);
    const prefix = dir === '.' ? '' : `${dir}/`;
    return [
      `${prefix}*.ts`,
      `${prefix}*.js`,
      `${prefix}*.tsx`,
      `${prefix}*.jsx`,
      `${prefix}*.json`,
      `${prefix}*.md`,
    ];
  }
}
