import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { RepoContextService } from './repo-context.service';
import { BuildResult, Task } from '../interfaces';
import { ENV } from '../env';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DRY';

type RunEvent = { ts: number; level: LogLevel; message: string; };
type TaskEventKind = 'start' | 'attempt' | 'fix-attempt' | 'llm' | 'tool' | 'build' | 'done' | 'failed';
type TaskEvent = { ts: number; kind: TaskEventKind; data?: any; };

type TaskLog = {
  task: Task;
  startTs?: number;
  endTs?: number;
  status?: string;
  attempts: number;
  fixAttempts: number;
  llmCalls: number;
  toolCalls: number;
  filesTouched: Set<string>;
  events: TaskEvent[];
};

@Injectable()
export class RunLoggerService {
  private filePath?: string;
  private runId?: string;
  private repoId?: string;
  private runStartTs?: number;
  private runEndTs?: number;
  private runStatus?: string;
  private runReason?: string;
  private runEvents: RunEvent[] = [];
  private taskLogs = new Map<string, TaskLog>();
  private taskOrder: string[] = [];
  private totalAttempts = 0;
  private totalFixAttempts = 0;
  private totalLLMCalls = 0;
  private totalToolCalls = 0;

  constructor(private readonly repoContext: RepoContextService) {}

  init(runId: string, repoId?: string) {
    const { aiPath } = this.repoContext.get();
    fs.mkdirSync(aiPath, { recursive: true });
    const stamp = this.formatRunStamp(new Date());
    this.filePath = path.join(aiPath, `${stamp}_${runId}.md`);
    this.runId = runId;
    this.repoId = repoId;
    this.runStartTs = Date.now();
    this.runEndTs = undefined;
    this.runStatus = undefined;
    this.runReason = undefined;
    this.runEvents = [];
    this.taskLogs = new Map<string, TaskLog>();
    this.taskOrder = [];
    this.totalAttempts = 0;
    this.totalFixAttempts = 0;
    this.totalLLMCalls = 0;
    this.totalToolCalls = 0;
    if (ENV.DRY_RUN) this.section('DRY RUN MODE');
  }

  private formatRunStamp(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}.${min}`;
  }

  private write(md: string) { if (this.filePath) fs.writeFileSync(this.filePath, md); }

  section(title: string) { this.runEvents.push({ ts: Date.now(), level: 'INFO', message: title }); }

  info(msg: string) { this.runEvents.push({ ts: Date.now(), level: 'INFO', message: msg }); }
  warn(msg: string) { this.runEvents.push({ ts: Date.now(), level: 'WARN', message: msg }); }
  error(msg: string) { this.runEvents.push({ ts: Date.now(), level: 'ERROR', message: msg }); }
  dry(msg: string) { this.runEvents.push({ ts: Date.now(), level: 'DRY', message: msg }); }

  private keyFor(task: Task): string {
    return task.id || task.title;
  }

  private getTaskLog(task: Task): TaskLog {
    const key = this.keyFor(task);
    let log = this.taskLogs.get(key);
    if (!log) {
      log = {
        task,
        attempts: 0,
        fixAttempts: 0,
        llmCalls: 0,
        toolCalls: 0,
        filesTouched: new Set<string>(),
        events: []
      };
      this.taskLogs.set(key, log);
      this.taskOrder.push(key);
    }
    return log;
  }

  // ---- Task events ----

  taskStart(task: Task) {
    const log = this.getTaskLog(task);
    log.startTs = Date.now();
    log.events.push({ ts: Date.now(), kind: 'start' });
  }

  taskAttempt(task: Task, n: number) {
    const log = this.getTaskLog(task);
    log.attempts++;
    this.totalAttempts++;
    log.events.push({ ts: Date.now(), kind: 'attempt', data: { n } });
  }

  taskAttemptFix(task: Task, n: number) {
    const log = this.getTaskLog(task);
    log.fixAttempts++;
    this.totalFixAttempts++;
    log.events.push({ ts: Date.now(), kind: 'fix-attempt', data: { n } });
  }

  taskLLMCall(task: Task, payload: { messages: any[]; response: any; durationMs: number; }) {
    const log = this.getTaskLog(task);
    log.llmCalls++;
    this.totalLLMCalls++;
    log.events.push({ ts: Date.now(), kind: 'llm', data: payload });
  }

  taskToolCall(task: Task, payload: { name: string; args: any; result: any; durationMs: number; }) {
    const log = this.getTaskLog(task);
    log.toolCalls++;
    this.totalToolCalls++;
    if (payload.args?.path && this.isWriteTool(payload.name)) {
      log.filesTouched.add(payload.args.path);
    }
    log.events.push({ ts: Date.now(), kind: 'tool', data: payload });
  }

  taskBuildResult(task: Task, payload: { phase: 'initial' | 'retry'; result: BuildResult; }) {
    const log = this.getTaskLog(task);
    log.events.push({ ts: Date.now(), kind: 'build', data: payload });
  }

  taskDone(task: Task) {
    const log = this.getTaskLog(task);
    log.endTs = Date.now();
    log.status = 'DONE';
    log.events.push({ ts: Date.now(), kind: 'done' });
  }

  taskFailed(task: Task) {
    const log = this.getTaskLog(task);
    log.endTs = Date.now();
    log.status = 'FAILED';
    log.events.push({ ts: Date.now(), kind: 'failed' });
  }

  // ---- Run lifecycle ----

  runInterrupted(reason = 'Shutdown requested') {
    this.runStatus = 'INTERRUPTED';
    this.runReason = reason;
    this.runEndTs = Date.now();
    this.flush();
  }

  runCompleted() {
    this.runStatus = 'COMPLETED';
    this.runEndTs = Date.now();
    this.flush();
  }

  runFailed(reason?: string) {
    this.runStatus = 'FAILED';
    this.runReason = reason;
    this.runEndTs = Date.now();
    this.flush();
  }

  private isWriteTool(name: string): boolean {
    return ['apply_patch', 'create_file', 'delete_file'].includes(name);
  }

  private flush() {
    const lines: string[] = [];
    const startedAt = this.runStartTs ? new Date(this.runStartTs) : new Date();
    const endedAt = this.runEndTs ? new Date(this.runEndTs) : new Date();

    lines.push(`# Run ${this.runId || ''}`.trim());
    if (this.repoId) lines.push(`Repo: ${this.repoId}`);
    lines.push(`Started: ${this.formatDateTime(startedAt)}`);
    lines.push(`Ended: ${this.formatDateTime(endedAt)}`);
    lines.push(`Status: ${this.runStatus || 'UNKNOWN'}`);
    lines.push(`Total duration: ${this.formatDuration(endedAt.getTime() - startedAt.getTime())}`);
    lines.push('');
    lines.push('## Statistics');
    lines.push('');
    lines.push('### Run Summary');
    lines.push('| Metric | Value |');
    lines.push('| --- | --- |');
    lines.push(`| Total tasks | ${this.taskOrder.length} |`);
    lines.push(`| Total attempts | ${this.totalAttempts} |`);
    lines.push(`| Total fix attempts | ${this.totalFixAttempts} |`);
    lines.push(`| Total LLM calls | ${this.totalLLMCalls} |`);
    lines.push(`| Total tool calls | ${this.totalToolCalls} |`);
    lines.push(`| Files touched | ${this.getAllTouchedFiles().length} |`);
    if (this.runReason) lines.push(`| Reason | ${this.escapePipes(this.runReason)} |`);
    lines.push('');
    const touchedFiles = this.getAllTouchedFiles();
    if (touchedFiles.length) {
      lines.push(`Files touched: ${this.escapePipes(touchedFiles.join(', '))}`);
      lines.push('');
    }
    lines.push('### Tasks');
    lines.push('| Task | Status | Duration | Attempts | Fix Attempts | LLM Calls | Tool Calls | Files Touched |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const key of this.taskOrder) {
      const log = this.taskLogs.get(key);
      if (!log) continue;
      const duration = this.formatDuration(this.getTaskDuration(log));
      const files = Array.from(log.filesTouched).join(', ');
      lines.push(`| ${this.escapePipes(log.task.title)} | ${log.status || 'UNKNOWN'} | ${duration} | ${log.attempts} | ${log.fixAttempts} | ${log.llmCalls} | ${log.toolCalls} | ${this.escapePipes(files || '-')} |`);
    }

    if (this.runEvents.length) {
      lines.push('');
      lines.push('## Run Events');
      for (const ev of this.runEvents) {
        lines.push(`- [${this.formatTime(new Date(ev.ts))}] ${ev.level}: ${this.escapePipes(ev.message)}`);
      }
    }

    for (const key of this.taskOrder) {
      const log = this.taskLogs.get(key);
      if (!log) continue;
      lines.push('');
      lines.push(`## Task [${this.escapePipes(log.task.title)}]`);
      lines.push('```json');
      lines.push(JSON.stringify(log.task, null, 2));
      lines.push('```');
      lines.push('');
      lines.push('### Timeline');
      for (const ev of log.events) {
        lines.push(...this.formatTaskEvent(ev));
      }
    }

    lines.push('');
    this.write(lines.join('\n'));
  }

  private formatTaskEvent(ev: TaskEvent): string[] {
    const time = this.formatTime(new Date(ev.ts));
    const lines: string[] = [];
    switch (ev.kind) {
      case 'start':
        lines.push(`- [${time}] Task started`);
        break;
      case 'attempt':
        lines.push(`- [${time}] Attempt ${ev.data?.n}`);
        break;
      case 'fix-attempt':
        lines.push(`- [${time}] Fix attempt ${ev.data?.n}`);
        break;
      case 'llm':
        lines.push(`- [${time}] LLM call (${this.formatDuration(ev.data?.durationMs || 0)})`);
        lines.push('```json');
        lines.push(JSON.stringify({ messages: ev.data?.messages, response: ev.data?.response }, null, 2));
        lines.push('```');
        break;
      case 'tool':
        lines.push(`- [${time}] Tool ${ev.data?.name} (${this.formatDuration(ev.data?.durationMs || 0)})`);
        lines.push('```json');
        lines.push(JSON.stringify({ args: ev.data?.args, result: ev.data?.result }, null, 2));
        lines.push('```');
        break;
      case 'build':
        lines.push(`- [${time}] Build ${ev.data?.phase} (${ev.data?.result?.success ? 'success' : 'failed'}) (${this.formatDuration(ev.data?.result?.durationMs || 0)})`);
        if (ev.data?.result?.stdout) {
          lines.push('```');
          lines.push(ev.data.result.stdout);
          lines.push('```');
        }
        if (ev.data?.result?.stderr) {
          lines.push('```');
          lines.push(ev.data.result.stderr);
          lines.push('```');
        }
        break;
      case 'done':
        lines.push(`- [${time}] Task done`);
        break;
      case 'failed':
        lines.push(`- [${time}] Task failed`);
        break;
      default:
        lines.push(`- [${time}] ${ev.kind}`);
    }
    return lines;
  }

  private getTaskDuration(log: TaskLog): number {
    if (!log.startTs) return 0;
    const end = log.endTs || Date.now();
    return end - log.startTs;
  }

  private getAllTouchedFiles(): string[] {
    const out = new Set<string>();
    for (const key of this.taskOrder) {
      const log = this.taskLogs.get(key);
      if (!log) continue;
      for (const f of log.filesTouched) out.add(f);
    }
    return Array.from(out);
  }

  private formatTime(d: Date): string {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  private formatDateTime(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    const rem = s - m * 60;
    return `${m}m ${rem.toFixed(1)}s`;
  }

  private escapePipes(s: string): string {
    return s.replace(/\|/g, '\\|');
  }
}
