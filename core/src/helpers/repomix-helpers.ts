import { RepomixConfig, Task } from '../types';

export class RepomixHelpers {
  static getRelatedFiles(task: Task): string[] {
    const list = new Set<string>();
    if (task.file) list.add(task.file);
    for (const f of task.relatedFiles || []) list.add(f);
    return Array.from(list);
  }

  static getMaxContextSize(cfg: RepomixConfig): number {
    return cfg.maxContextSize || 30000;
  }

  static buildConfig(cfg: RepomixConfig, outputPath: string, relatedFiles: string[] | null) {
    return {
      output: {
        filePath: outputPath,
        style: cfg.style || 'markdown',
        removeComments: cfg.removeComments ?? false,
        removeEmptyLines: cfg.removeEmptyLines ?? true,
        showLineNumbers: cfg.showLineNumbers ?? false,
        topFilesLength: cfg.topFilesLength
      },
      include: relatedFiles && relatedFiles.length ? relatedFiles : (cfg.include || [
        '**/*.ts',
        '**/*.js',
        '**/*.tsx',
        '**/*.jsx',
        '**/*.json',
        '**/*.md'
      ]),
      ignore: {
        useGitignore: cfg.ignore?.useGitignore ?? true,
        useDefaultPatterns: cfg.ignore?.useDefaultPatterns ?? true,
        customPatterns: cfg.ignore?.customPatterns || [
          'node_modules/**',
          'dist/**',
          'build/**',
          '**/*.test.*',
          '**/*.spec.*',
          '**/test/**',
          '.git/**'
        ]
      }
    };
  }
}
