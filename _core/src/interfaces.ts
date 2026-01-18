export interface CommitContext {
  commitHash: string;
  commitMessage: string;
  files: string[];
  baseBranch: string;
}

export interface Task {
  description: string;
  files: string[];
  type: 'markdown' | 'code-comment' | 'general';
  context?: string;
}

export interface TaskResult {
  success: boolean;
  task: Task;
  error?: string;
  affectedPackages: string[];
  buildSuccess?: boolean;
  testSuccess?: boolean;
  lintSuccess?: boolean;
}

export interface PackageInfo {
  name: string;
  path: string;
  hasChanged: boolean;
  scripts: Record<string, string>;
}

export interface ActivityMetrics {
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  commitHash: string;
  commitMessage: string;
  baseBranch: string;
  aiBranch?: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalFilesChanged: number;
  totalFilesCreated: number;
  totalFilesDeleted: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  tasks: TaskMetrics[];
  errors: string[];
}

export interface TaskMetrics {
  taskNumber: number;
  description: string;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  status: 'running' | 'success' | 'failed';
  filesChanged: string[];
  filesCreated: string[];
  filesDeleted: string[];
  linesAdded: number;
  linesRemoved: number;
  affectedPackages: string[];
  buildSuccess?: boolean;
  testSuccess?: boolean;
  lintSuccess?: boolean;
  llmCalls: number;
  toolCalls: ToolCallMetric[];
  error?: string;
}

export interface ToolCallMetric {
  toolName: string;
  arguments: any;
  timestamp: Date;
  durationMs: number;
  success: boolean;
}

export interface RepositoryConfig {
  name: string;
  watchBranch: string;
  enabled: boolean;
  installScript?: string;
  buildScript?: string;
  testScript?: string;
  gitRemote?: string; // URL del repository remoto
  sshKeyPath?: string; // Percorso chiave SSH specifica per questo repo
}

export interface MultiRepoConfig {
  repositories: RepositoryConfig[];
  llm: {
    apiUrl: string;
    apiKey: string;
    model: string;
  };
  repomix: {
    maxContextSize: number;
  };
  defaults: {
    pollInterval: number;
    watchBranch: string;
  };
}