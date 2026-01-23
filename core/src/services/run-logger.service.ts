import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { RepoContextService } from './repo-context.service';
import { BuildResult, RunEvent, Task, TaskEvent, TaskLog } from '../types';
import { ENV } from '../env';
import { RunLogFormatters } from '../helpers/run-log-formatters';
import { toLocalIso } from '../libs/utils';

@Injectable()
export class RunLoggerService {
  private runDir?: string;
  private summaryPath?: string;
  private runId?: string;
  private repoId?: string;
  private runStartTs?: number;
  private runEndTs?: number;
  private runStatus?: string;
  private runReason?: string;
  private installResult?: { success: boolean; stdout: string; stderr: string; };
  private runEvents: RunEvent[] = [];
  private taskLogs = new Map<string, TaskLog>();
  private taskOrder: string[] = [];
  private totalAttempts = 0;
  private totalFixAttempts = 0;
  private totalLLMCalls = 0;
  private totalToolCalls = 0;

  constructor(private readonly repoContext: RepoContextService) {}

  init(runId: string, repoId?: string, commit?: string) {
    const { aiPath } = this.repoContext.get();
    fs.mkdirSync(aiPath, { recursive: true });
    const stamp = this.formatRunStamp(new Date());
    const safeCommit = (commit || '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    const dirName = [stamp, runId, safeCommit].filter(Boolean).join(' - ');
    this.runDir = path.join(aiPath, dirName);
    fs.mkdirSync(this.runDir, { recursive: true });
    this.summaryPath = path.join(this.runDir, 'summary.md');
    this.runId = runId;
    this.repoId = repoId;
    this.runStartTs = Date.now();
    this.runEndTs = undefined;
    this.runStatus = undefined;
    this.runReason = undefined;
    this.installResult = undefined;
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
    const iso = toLocalIso(d);
    const [datePart, timePart] = iso.split('T');
    const hhmm = timePart.split(':').slice(0, 2).join('.');
    return `${datePart} ${hhmm}`;
  }

  private write(targetPath: string | undefined, md: string) {
    if (targetPath) fs.writeFileSync(targetPath, md);
    const label = targetPath ? ` (${path.basename(targetPath)})` : '';
    console.log(`\n[node-droid] ${toLocalIso()} log${label}\n${md}`);
  }

  section(title: string) { this.runEvents.push({ ts: Date.now(), level: 'INFO', message: title }); }

  info(msg: string) { this.runEvents.push({ ts: Date.now(), level: 'INFO', message: msg }); }
  warn(msg: string) { this.runEvents.push({ ts: Date.now(), level: 'WARN', message: msg }); }
  error(msg: string) { this.runEvents.push({ ts: Date.now(), level: 'ERROR', message: msg }); }
  dry(msg: string) { this.runEvents.push({ ts: Date.now(), level: 'DRY', message: msg }); }

  npmInstallResult(success: boolean, stdout: string, stderr: string) {
    this.installResult = { success, stdout, stderr };
  }

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
    lines.push(`Started: ${RunLogFormatters.formatDateTime(startedAt)}`);
    lines.push(`Ended: ${RunLogFormatters.formatDateTime(endedAt)}`);
    lines.push(`Status: ${this.runStatus || 'UNKNOWN'}`);
    lines.push(`Total duration: ${RunLogFormatters.formatDuration(endedAt.getTime() - startedAt.getTime())}`);
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
    if (this.runReason) lines.push(`| Reason | ${RunLogFormatters.escapePipes(this.runReason)} |`);
    lines.push('');
    const touchedFiles = this.getAllTouchedFiles();
    if (touchedFiles.length) {
      lines.push(`Files touched: ${RunLogFormatters.escapePipes(touchedFiles.join(', '))}`);
      lines.push('');
    }
    lines.push('### Tasks');
    lines.push('| Task | Status | Duration | Attempts | Fix Attempts | LLM Calls | Tool Calls | Files Touched |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const key of this.taskOrder) {
      const log = this.taskLogs.get(key);
      if (!log) continue;
      const duration = RunLogFormatters.formatDuration(this.getTaskDuration(log));
      const files = Array.from(log.filesTouched).join(', ');
      lines.push(`| ${RunLogFormatters.escapePipes(log.task.title)} | ${log.status || 'UNKNOWN'} | ${duration} | ${log.attempts} | ${log.fixAttempts} | ${log.llmCalls} | ${log.toolCalls} | ${RunLogFormatters.escapePipes(files || '-')} |`);
    }

    if (this.installResult) {
      lines.push('');
      lines.push('## Install');
      lines.push(`Status: ${this.installResult.success ? 'success' : 'failed'}`);
      if (this.installResult.stdout) {
        lines.push('');
        lines.push('```');
        lines.push(this.installResult.stdout);
        lines.push('```');
      }
      if (this.installResult.stderr) {
        lines.push('');
        lines.push('```');
        lines.push(this.installResult.stderr);
        lines.push('```');
      }
    }

    if (this.runEvents.length) {
      lines.push('');
      lines.push('## Run Events');
      for (const ev of this.runEvents) {
        lines.push(`- [${RunLogFormatters.formatTime(new Date(ev.ts))}] ${ev.level}: ${RunLogFormatters.escapePipes(ev.message)}`);
      }
    }

    lines.push('');
    this.write(this.summaryPath, lines.join('\n'));

    for (let i = 0; i < this.taskOrder.length; i++) {
      const key = this.taskOrder[i];
      const log = this.taskLogs.get(key);
      if (!log) continue;
      const taskMd = this.buildTaskMarkdown(log, i + 1);
    const taskPath = this.runDir ? path.join(this.runDir, this.getTaskFileName(log, i + 1)) : undefined;
    this.write(taskPath, taskMd);
  }
  }

  private getTaskDuration(log: TaskLog): number {
    if (!log.startTs) return 0;
    const end = log.endTs || Date.now();
    return end - log.startTs;
  }

  private getTaskFileName(log: TaskLog, index: number): string {
    const base = (log.task.title || log.task.id || 'task')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return `${String(index).padStart(2, '0')}-${base || 'task'}.md`;
  }

  private buildTaskMarkdown(log: TaskLog, index: number): string {
    const lines: string[] = [];
    lines.push(`# Task ${index}: ${log.task.title}`);
    lines.push('');
    lines.push('## Task');
    lines.push('');
    lines.push(`- Title: ${log.task.title}`);
    lines.push(`- Description: ${log.task.description || '-'}`);
    lines.push(`- Source: ${log.task.source || '-'}`);
    if (log.task.file) lines.push(`- File: ${log.task.file}`);
    if (log.task.line) lines.push(`- Line: ${log.task.line}`);
    lines.push('');

    lines.push('## Files Touched');
    lines.push('');
    const filesTouched = Array.from(log.filesTouched);
    if (!filesTouched.length) {
      lines.push('_No files touched_');
    } else {
      lines.push(filesTouched.map(f => `- ${f}`).join('\n'));
    }
    lines.push('');

    lines.push('## Prompt (full)');
    lines.push('');
    const firstLLM = log.events.find(e => e.kind === 'llm');
    if (firstLLM?.data?.messages) {
      lines.push('```json');
      lines.push(JSON.stringify(firstLLM.data.messages, null, 2));
      lines.push('```');
    } else {
      lines.push('_No prompt recorded_');
    }
    lines.push('');

    lines.push('## LLM Calls');
    lines.push('');
    const llmEvents = log.events.filter(e => e.kind === 'llm');
    if (!llmEvents.length) {
      lines.push('_No LLM calls_');
      lines.push('');
    } else {
      const last = llmEvents[llmEvents.length - 1];
      lines.push(`- Total calls: ${llmEvents.length}`);
      lines.push(`- Total duration: ${RunLogFormatters.formatDuration(llmEvents.reduce((s, e) => s + (e.data?.durationMs || 0), 0))}`);
      lines.push('');
      lines.push('## Final Conversation');
      lines.push('');
      lines.push(...this.renderConversation(last.data?.messages || []));
      lines.push('## Final Response');
      lines.push('');
      lines.push(...this.renderFinalResponse(last.data?.response || {}));
      lines.push('');
    }

    lines.push('## Tool Calls');
    lines.push('');
    const toolEvents = log.events.filter(e => e.kind === 'tool');
    if (!toolEvents.length) {
      lines.push('_No tool calls_');
    } else {
      toolEvents.forEach((ev, i) => {
        lines.push(`### Tool ${i + 1}: ${ev.data?.name || 'unknown'}`);
        lines.push('');
        lines.push(`- Duration: ${RunLogFormatters.formatDuration(ev.data?.durationMs || 0)}`);
        lines.push('');
        lines.push('**Request**');
        lines.push('```json');
        lines.push(JSON.stringify(ev.data?.args || {}, null, 2));
        lines.push('```');
        lines.push('**Response**');
        lines.push('```json');
        lines.push(JSON.stringify(ev.data?.result || {}, null, 2));
        lines.push('```');
        lines.push('');
      });
    }
    lines.push('');

    lines.push('## Files Read/Written');
    lines.push('');
    const fileEntries: Array<{ kind: string; path: string; content?: string }> = [];
    for (const ev of toolEvents) {
      const name = ev.data?.name;
      const args = ev.data?.args || {};
      const result = ev.data?.result || {};
      if (name === 'read_file' && args.path && typeof result.output === 'string') {
        fileEntries.push({ kind: 'read', path: args.path, content: result.output });
      }
      if (name === 'create_file' && args.path && typeof args.content === 'string') {
        fileEntries.push({ kind: 'write', path: args.path, content: args.content });
      }
      if (name === 'apply_patch' && args.path && typeof args.patch === 'string') {
        fileEntries.push({ kind: 'patch', path: args.path, content: args.patch });
      }
    }
    if (!fileEntries.length) {
      lines.push('_No file contents captured_');
    } else {
      for (const entry of fileEntries) {
        lines.push(`### ${entry.kind.toUpperCase()}: ${entry.path}`);
        lines.push('```');
        lines.push(entry.content || '');
        lines.push('```');
        lines.push('');
      }
    }

    lines.push('## Outcome');
    lines.push('');
    lines.push(`- Status: ${log.status || 'UNKNOWN'}`);
    lines.push(`- Result: ${log.task.result || '-'}`);
    lines.push('');
    lines.push('## Timeline');
    lines.push('');
    for (const ev of log.events) {
      lines.push(...RunLogFormatters.formatTaskEvent(ev));
    }
    lines.push('');
    return lines.join('\n');
  }

  private renderConversation(messages: any[]): string[] {
    const lines: string[] = [];
    if (!messages.length) {
      lines.push('_No messages recorded_');
      return lines;
    }
    const toolOutputs = new Map<string, any>();
    for (const msg of messages) {
      if (msg.role === 'tool' && msg.tool_call_id) {
        toolOutputs.set(msg.tool_call_id, msg);
      }
    }
    for (const msg of messages) {
      const role = (msg.role || 'unknown').toString().toLowerCase();
      lines.push(this.renderRoleHeading(role));
      lines.push('');
      switch (msg.role) {
        case 'system':
          lines.push(...this.renderSystemMessage(msg));
          break;
        case 'user':
          lines.push(...this.renderUserMessage(msg));
          break;
        case 'assistant':
          lines.push(...this.renderAssistantMessage(msg, toolOutputs));
          break;
        case 'tool':
          lines.push(...this.renderToolMessage(msg));
          break;
        default:
          lines.push('```json');
          lines.push(JSON.stringify(msg, null, 2));
          lines.push('```');
      }
      lines.push('');
    }
    return lines;
  }

  private renderRoleHeading(role: string): string {
    switch (role) {
      case 'system':
        return '## 💻 System';
      case 'user':
        return '## 🧑 User';
      case 'assistant':
        return '## 🤖 Assistant';
      case 'tool':
        return '## 🛠️ Tool';
      default:
        return `## §§ ${role.toUpperCase()}`;
    }
  }

  private renderSystemMessage(msg: any): string[] {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '', null, 2);
    return [
      '***',
      content,
      '***'
    ];
  }

  private renderUserMessage(msg: any): string[] {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '', null, 2);
    return [
      '***',
      content,
      '***'
    ];
  }

  private renderAssistantMessage(msg: any, toolOutputs: Map<string, any>): string[] {
    const lines: string[] = [];
    if (msg.content) {
      lines.push('***');
      lines.push(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2));
      lines.push('***');
      lines.push('');
    }
    if (msg.tool_calls && msg.tool_calls.length) {
      for (const call of msg.tool_calls) {
        const fnName = call.function?.name || 'tool';
        const args = this.safeJsonParse(call.function?.arguments || '{}');
        const path = args?.path || '-';
        lines.push(`### ${this.functionEmoji(fnName)} ${fnName}`);
        lines.push('');
        lines.push(`#### 🗂️ Path: **${path}**`);
        if (typeof args?.content === 'string' && args.content.trim()) {
          lines.push('');
          lines.push(args.content);
        } else if (typeof args?.patch === 'string' && args.patch.trim()) {
          lines.push('');
          lines.push(args.patch);
        }
        lines.push('');
        const toolMsg = toolOutputs.get(call.id);
        const rendered = this.renderToolOutput(toolMsg);
        lines.push(...rendered);
        lines.push('');
      }
    }
    if (!lines.length) {
      lines.push('_Empty assistant message_');
    }
    return lines;
  }

  private renderToolMessage(msg: any): string[] {
    const lines: string[] = [];
    if (msg.tool_call_id) lines.push(`- tool_call_id: ${msg.tool_call_id}`);
    if (msg.name) lines.push(`- name: ${msg.name}`);
    const content = msg.content;
    if (content !== undefined) {
      lines.push('');
      lines.push('***');
      lines.push(this.safeJson(content));
      lines.push('***');
    }
    return lines.length ? lines : ['_Empty tool message_'];
  }

  private renderFinalResponse(response: any): string[] {
    return ['```json', JSON.stringify(response, null, 2), '```'];
  }

  private renderToolOutput(toolMsg: any): string[] {
    if (!toolMsg) {
      return ['### ❓ Output', '```\n_no output captured_\n```'];
    }
    const parsed = this.safeJsonParse(toolMsg.content);
    const success = typeof parsed?.success === 'boolean' ? parsed.success : undefined;
    const emoji = success === false ? '❌' : '✅';
    const output = parsed?.output !== undefined ? parsed.output : toolMsg.content;
    const outText = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    return [`### ${emoji} Output`, '```', outText, '```'];
  }

  private functionEmoji(name: string): string {
    switch (name) {
      case 'read_file':
        return '📖';
      case 'list_files':
        return '📂';
      case 'save_file':
        return '💾';
      default:
        return '❓';
    }
  }

  private safeJson(value: any): string {
    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    return JSON.stringify(value, null, 2);
  }

  private safeJsonParse(value: any): any {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return { raw: value };
    }
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

}
