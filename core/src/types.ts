export type TaskOutcome = 'TODO' |'DONE' | 'FAILED' | 'INTERRUPTED';
export type RunPhase =
  | 'IDLE'
  | 'BOOTSTRAP'
  | 'CONTEXT_EXTRACTION'
  | 'TASK_EXTRACTION'
  | 'TASK_EXECUTION'
  | 'FINALIZATION'
  | 'DONE'
  | 'FAILED';
export type RunStatus = 'RUNNING' | 'STOPPED' | 'FAILED' | 'COMPLETED' | 'INTERRUPTED';

/* ---------- Repo & Workspace ---------- */

export interface RepoDefinition {
  id: string;
  remote: string;
  baseBranch: string;
  buildCommand?: string;
  llm?: Partial<LLMProfile>;
  agent?: {
    maxTaskRetries?: number;
    stopOnFailure?: boolean;
    maxToolCallsPerTask?: number;
  };
  triggers?: { commitPrefix?: string };
  token?: string;
  repomix?: RepomixConfig;
}

export interface RepoDescriptor { id: string; path: string; config: RepoDefinition; }

export interface RepoContext {
  id: string;
  rootPath: string;
  codePath: string;
  aiPath: string;
  sshPath?: string;
  remote: string;
  baseBranch: string;
  buildCommand: string;
  llmProfile: LLMProfile;
  agentPolicy: {
    maxTaskRetries?: number;
    stopOnFailure?: boolean;
    maxToolCallsPerTask?: number;
  };
  repomix?: RepomixConfig;
}

/* ---------- LLM ---------- */

export interface LLMProfile {
  provider: 'openai-compatible';
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/* ---------- Tasks ---------- */

export interface Task {
  id: string;
  title: string;
  description: string;
  source: string;
  file?: string;
  line?: number;
  attempts?: number;
  relatedFiles?: string[];
  result?: string;
  status: TaskOutcome;
  codeSnippet?: string;
  projects?: Array<{ packageJson: string; name: string }>;
}

/* ---------- Tools ---------- */

export interface ToolDefinition { name: string; description: string; parameters: any; }
export interface ToolCall { name: string; arguments: Record<string, any>; }
export interface ToolResult { success: boolean; output?: any; error?: string; }

/* ---------- Build ---------- */

export interface BuildResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/* ---------- Git ---------- */

export interface GitRemoteUpdates { branch: string; commits: string[]; files: string[]; error?: string; }

/* ---------- Run ---------- */

export interface RunContext {
  runId: string;
  repoId: string;
  branchName: string;
  triggerCommit: { hash: string; author: string; message: string; timestamp: string };
  startedAt: string;
}

/* ---------- Logging ---------- */

export type RunEvent = { ts: number; level: 'INFO' | 'WARN' | 'ERROR' | 'DRY'; message: string; emoji?: string };
export type TaskEvent = { ts: number; kind: 'start' | 'attempt' | 'fix-attempt' | 'llm' | 'tool' | 'build' | 'done' | 'failed'; data?: any };
export type RunReportTask = {
  task: Task;
  startTs?: number;
  endTs?: number;
  status?: string;
  attempts: number;
  fixAttempts: number;
  llmCalls: number;
  toolCalls: number;
  filesTouched: string[];
  events: TaskEvent[];
};

export type RunReport = {
  meta: {
    runId?: string;
    repoId?: string;
    commit?: string;
    startedAt: number;
    endedAt?: number;
    status?: string;
    reason?: string;
  };
  stats: {
    totalAttempts: number;
    totalFixAttempts: number;
    totalLLMCalls: number;
    totalToolCalls: number;
  };
  installResult?: { success: boolean; stdout: string; stderr: string };
  events: RunEvent[];
  tasks: RunReportTask[];
};

/* ---------- Summaries (optional) ---------- */


/* ---------- Repomix ---------- */

export interface RepomixConfig {
  enabled?: boolean;
  maxContextSize?: number;
  style?: 'markdown' | 'plain' | 'xml' | 'json';
  include?: string[];
  ignore?: {
    useGitignore?: boolean;
    useDefaultPatterns?: boolean;
    customPatterns?: string[];
  };
  removeComments?: boolean;
  removeEmptyLines?: boolean;
  showLineNumbers?: boolean;
  topFilesLength?: number;
}
