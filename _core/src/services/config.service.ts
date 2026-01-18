// packages/core/src/services/config.service.ts

import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MultiRepoConfig, RepositoryConfig } from '../interfaces';

@Injectable()
export class ConfigService {

  private config: MultiRepoConfig;
  private readonly configPath = process.env.CONFIG_PATH || './node-droid.config.json';

  async refresh() {
    try {
      const configFile = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configFile);
      
      // Valida la configurazione
      this.validateConfig();
      
      console.log(`✅ Configuration loaded: ${this.config.repositories.length} repositories`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Se non esiste, crea config di default da env vars (backward compatibility)
        this.config = this.createDefaultConfigFromEnv();
        console.log('⚠️  No config file found, using environment variables');
      } else {
        throw new Error(`Failed to load configuration: ${error.message}`);
      }
    }
  }

  private createDefaultConfigFromEnv(): MultiRepoConfig {
    return {
      repositories: [
        {
          name: process.env.REPO_NAME || 'default-repo',
          path: process.env.REPO_PATH || '/workspace/repo',
          watchBranch: process.env.WATCH_BRANCH || 'main',
          enabled: true
        }
      ],
      llm: {
        apiUrl: process.env.LLM_API_URL || 'http://localhost:8000/v1',
        apiKey: process.env.LLM_API_KEY || 'dummy',
        model: process.env.LLM_MODEL || 'llama-3-70b'
      },
      repomix: {
        maxContextSize: parseInt(process.env.REPOMIX_MAX_CONTEXT_SIZE || '30000')
      },
      defaults: {
        pollInterval: parseInt(process.env.POLL_INTERVAL || '30000'),
        watchBranch: 'main'
      }
    };
  }

  private validateConfig() {
    if (!this.config.repositories || this.config.repositories.length === 0) {
      throw new Error('Configuration must contain at least one repository');
    }

    for (const repo of this.config.repositories) {
      if (!repo.name || !repo.path) {
        throw new Error(`Repository configuration missing required fields: ${JSON.stringify(repo)}`);
      }
    }

    if (!this.config.llm || !this.config.llm.apiUrl) {
      throw new Error('LLM configuration is required');
    }
  }

  getRepositories(): RepositoryConfig[] {
    return this.config.repositories.filter(r => r.enabled);
  }

  getRepository(name: string): RepositoryConfig | undefined {
    return this.config.repositories.find(r => r.name === name);
  }

  getLLMConfig() {
    return this.config.llm;
  }

  getRepomixConfig() {
    return this.config.repomix;
  }

  getDefaults() {
    return this.config.defaults;
  }

  getPollInterval(repo: RepositoryConfig): number {
    return repo.pollInterval || this.config.defaults.pollInterval;
  }

  getWatchBranch(repo: RepositoryConfig): string {
    return repo.watchBranch || this.config.defaults.watchBranch;
  }
}