export type TaskOutcome = 'TODO' |'DONE' | 'FAILED' | 'INTERRUPTED' | 'BLOCKED';
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
  blocker?: {
    type: 'missing_dependency' | 'missing_requirement' | 'missing_access' | 'unknown';
    message: string;
    packageName?: string;
  };
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
  triggerCommit?: { hash?: string; author?: string; message: string; timestamp?: string };
  startedAt: string;
}

export interface RunSnapshot {
  phase: RunPhase;
  status: RunStatus;
  shuttingDown: boolean;
  context?: RunContext;
  currentTask?: {
    id?: string;
    title: string;
    index?: number;
    status?: TaskOutcome;
  };
  attempt: number;
}

export type AuditEventType =
  | 'run.event'
  | 'run.status'
  | 'task.status'
  | 'task.attempt'
  | 'task.context'
  | 'task.build'
  | 'task.tool'
  | 'task.llm';

export interface AuditEvent {
  type: AuditEventType;
  ts: number;
  app: string;
  version: string;
  repoId?: string;
  runId?: string;
  branch?: string;
  topic: string;
  snapshot?: RunSnapshot;
  payload: Record<string, any>;
}

/* ---------- Logging ---------- */

export type RunEvent = { ts: number; level: 'INFO' | 'WARN' | 'ERROR' | 'DRY'; message: string; emoji?: string };
export type TaskEvent = { ts: number; kind: 'start' | 'attempt' | 'fix-attempt' | 'context' | 'llm' | 'tool' | 'build' | 'done' | 'failed' | 'blocked'; data?: any };
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
