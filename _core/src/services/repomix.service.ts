// packages/core/src/services/repomix.service.ts

import { Injectable, OnModuleInit } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Task } from '../interfaces/types';

const execAsync = promisify(exec);

@Injectable()
export class RepomixService implements OnModuleInit {
  private readonly repoPath = ENV.REPO_PATH || '/workspace/repo';
  private readonly activityDir = path.join(this.repoPath, '.ai-activity');
  private isAvailable = false;
  private projectContext: string | null = null;
  private lastGenerated: Date | null = null;
  private readonly cacheValidityMs = 5 * 60 * 1000; // 5 minuti
  private readonly maxContextSize = parseInt(ENV.REPOMIX_MAX_CONTEXT_SIZE || '30000');

  async onModuleInit() {
    await this.checkAvailability();
    
    if (this.isAvailable) {
      console.log('✅ Repomix is available, project context will be enhanced');
      // Pre-genera il contesto iniziale
      await this.generateProjectContext();
    } else {
      console.log('⚠️  Repomix not found in devDependencies, running without project context enhancement');
    }
  }

  private async checkAvailability(): Promise<void> {
    try {
      // Verifica se repomix è nelle devDependencies
      const packageJsonPath = path.join(this.repoPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      const hasRepomix = 
        packageJson.devDependencies?.repomix ||
        packageJson.dependencies?.repomix;

      if (!hasRepomix) {
        this.isAvailable = false;
        return;
      }

      // Verifica che sia effettivamente eseguibile
      await execAsync('npx repomix --version', { cwd: this.repoPath });
      this.isAvailable = true;
    } catch (error) {
      this.isAvailable = false;
    }
  }

  async generateProjectContext(force = false, repoPath?: string): Promise<string | null> {
    
    const targetPath = repoPath || this.repoPath;

    if (!this.isAvailable) {
      return null;
    }

    // Usa la cache se valida
    if (!force && this.projectContext && this.lastGenerated) {
      const age = Date.now() - this.lastGenerated.getTime();
      if (age < this.cacheValidityMs) {
        return this.projectContext;
      }
    }

    try {
      console.log('🔄 Generating project context with Repomix...');
      
      await fs.mkdir(this.activityDir, { recursive: true });
      const outputPath = path.join(this.activityDir, 'repomix-output.txt');
      
      // Crea configurazione Repomix ottimizzata per LLM context
      const configPath = await this.createRepomixConfig();
      
      // Esegui repomix
      await execAsync(
        `npx repomix --config ${configPath} --output ${outputPath}`,
        { 
          cwd: targetPath,
          timeout: 30000 // 30 secondi timeout
        }
      );

      // Leggi l'output generato
      this.projectContext = await fs.readFile(outputPath, 'utf-8');
      this.lastGenerated = new Date();

      // Pulisci i file temporanei
      await fs.unlink(outputPath).catch(() => {});
      await fs.unlink(configPath).catch(() => {});

      console.log(`✅ Project context generated (${this.projectContext.length} chars)`);
      
      return this.projectContext;
    } catch (error) {
      console.error('⚠️  Failed to generate project context:', error.message);
      this.isAvailable = false; // Disabilita per questa sessione
      return null;
    }
  }

  private async createRepomixConfig(): Promise<string> {
    const configPath = path.join(this.activityDir, 'repomix.config.json');

    const config = {
      output: {
        filePath: "repomix-output.txt",
        style: "markdown",
        removeComments: false,
        removeEmptyLines: false,
        topFilesLength: 5,
        showLineNumbers: false,
        copyToClipboard: false
      },
      include: [
        "**/*.ts",
        "**/*.js",
        "**/*.tsx",
        "**/*.jsx",
        "**/*.json",
        "**/*.md"
      ],
      ignore: {
        useGitignore: true,
        useDefaultPatterns: true,
        customPatterns: [
          "node_modules/**",
          "dist/**",
          "build/**",
          ".next/**",
          ".ai-activity/**",
          "**/*.test.ts",
          "**/*.spec.ts",
          "**/*.test.js",
          "**/*.spec.js",
          "**/test/**",
          "**/tests/**",
          "coverage/**",
          ".git/**"
        ]
      },
      security: {
        enableSecurityCheck: true
      }
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    return configPath;
  }

  async invalidateCache(): Promise<void> {
    this.projectContext = null;
    this.lastGenerated = null;
  }

  getAvailability(): boolean {
    return this.isAvailable;
  }

  async getSmartProjectContext(task: Task): Promise<string | null> {
    if (!this.isAvailable) {
      return null;
    }

    // Strategia 1: Contesto focalizzato sui file del task (più preciso)
    if (task.files && task.files.length > 0 && task.files.length < 20) {
      const focusedContext = await this.getFocusedContext(task.files);
      
      if (focusedContext && focusedContext.length <= this.maxContextSize) {
        console.log(`📍 Using focused context (${focusedContext.length} chars)`);
        return focusedContext;
      }
    }

    // Strategia 2: Contesto completo se è abbastanza piccolo
    const fullContext = await this.generateProjectContext();
    
    if (fullContext && fullContext.length <= this.maxContextSize) {
      console.log(`📦 Using full project context (${fullContext.length} chars)`);
      return fullContext;
    }

    // Strategia 3: Tronca il contesto in modo intelligente
    if (fullContext) {
      console.warn(`⚠️  Context too large (${fullContext.length} chars), truncating to ${this.maxContextSize}`);
      return fullContext.substring(0, this.maxContextSize) + '\n\n... [context truncated due to size]';
    }

    return null;
  }

  async getFocusedContext(relatedFiles: string[]): Promise<string | null> {
    if (!this.isAvailable || relatedFiles.length === 0) {
      return null;
    }

    try {
      const configPath = await this.createFocusedConfig(relatedFiles);
      const outputPath = path.join(this.activityDir, 'repomix-focused.txt');
      
      await execAsync(
        `npx repomix --config ${configPath} --output ${outputPath}`,
        { 
          cwd: this.repoPath,
          timeout: 15000
        }
      );

      const context = await fs.readFile(outputPath, 'utf-8');

      // Cleanup
      await fs.unlink(outputPath).catch(() => {});
      await fs.unlink(configPath).catch(() => {});

      return context;
    } catch (error) {
      console.warn('⚠️  Failed to generate focused context:', error.message);
      return null;
    }
  }

  private async createFocusedConfig(relatedFiles: string[]): Promise<string> {
    const configPath = path.join(this.activityDir, 'repomix-focused.config.json');
    
    // Espandi i file correlati per includere le directory parent
    const patterns = new Set<string>();
    
    for (const file of relatedFiles) {
      patterns.add(file);
      
      // Aggiungi file nella stessa directory
      const dir = path.dirname(file);
      if (dir !== '.') {
        patterns.add(`${dir}/**/*.ts`);
        patterns.add(`${dir}/**/*.tsx`);
        patterns.add(`${dir}/**/*.js`);
        patterns.add(`${dir}/**/*.jsx`);
      }
    }

    const config = {
      output: {
        filePath: "repomix-focused.txt",
        style: "markdown",
        removeComments: false,
        removeEmptyLines: true,
        showLineNumbers: true
      },
      include: Array.from(patterns),
      ignore: {
        useGitignore: true,
        useDefaultPatterns: true,
        customPatterns: [
          "node_modules/**",
          "dist/**",
          "build/**",
          "**/*.test.*",
          "**/*.spec.*",
          "**/test/**"
        ]
      }
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    return configPath;
  }
}