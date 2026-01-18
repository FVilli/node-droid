import { TaskPriority, TaskSource, TaskStatus } from './types';

/* ---------- Repo & Workspace ---------- */

export interface RepoDefinition { id: string; remote: string; baseBranch: string; buildCommand?: string; llm?: LLMProfileOverride; agent?: RepoAgentPolicy; triggers?: { commitPrefix?: string; }; }

export interface RepoDescriptor { id: string; path: string; config: RepoDefinition; }

export interface RepoContext {
  id: string; rootPath: string; codePath: string; aiPath: string; sshPath?: string;
  remote: string; baseBranch: string; buildCommand: string;
  llmProfile: LLMProfile; agentPolicy: RepoAgentPolicy;
}

/* ---------- LLM ---------- */

export interface LLMProfile { provider: 'openai-compatible'; baseUrl: string; apiKey: string; model: string; temperature?: number; maxTokens?: number; }

export interface LLMProfileOverride { baseUrl?: string; apiKey?: string; model?: string; temperature?: number; maxTokens?: number; }

/* ---------- Policies ---------- */

export interface RepoAgentPolicy { maxTaskRetries?: number; stopOnFailure?: boolean; maxToolCallsPerTask?: number; }

/* ---------- Tasks ---------- */

export interface RawTask { title: string; description?: string; source: string; file?: string; line?: number; }

export interface Task {
  id: string; title: string; description?: string; source: string; file?: string; line?: number;
  relatedFiles?: string[]; status: TaskStatus; attempts: number;
}

/* ---------- Task Execution ---------- */

export interface TaskExecutionResult { taskId: string; status: TaskStatus; attempts: number; lastError?: string; }

/* ---------- Tools ---------- */

export interface ToolDefinition { name: string; description: string; parameters: any; }
export interface ToolCall { name: string; arguments: Record<string, any>; }
export interface ToolResult { success: boolean; output?: any; error?: string; }

/* ---------- Build ---------- */

export interface BuildResult { success: boolean; exitCode: number; stdout: string; stderr: string; durationMs: number; }

/* ---------- Git ---------- */

export interface GitDiffSummary { added: string[]; modified: string[]; removed: string[]; }
export interface GitCommitInfo { hash: string; author: string; message: string; timestamp: string; }
export interface GitRemoteDelta { branch: string; commits: string[]; files: string[]; error?: string; }

/* ---------- Run ---------- */

export interface RunContext { runId: string; repoId: string; branchName: string; triggerCommit: GitCommitInfo; startedAt: string; }
export interface RunOutcome { success: boolean; failedTasks: string[]; completedTasks: string[]; }

/* ---------- Logging ---------- */

export interface RunLogSection { title: string; content: string; }

/* ---------- Summaries (optional) ---------- */

export interface CommitSemanticAnalysis { type: string; summary: string; riskLevel?: 'low' | 'medium' | 'high'; notes?: string; }
export interface DiffSummary { summary: string; keyChanges: string[]; }
export interface RunSummary { summary: string; completedTasks: number; failedTasks: number; notes?: string; }
