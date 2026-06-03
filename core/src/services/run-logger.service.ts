import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { RepoContextService } from './repo-context.service';
import {
  BuildResult,
  RunReport,
  RunReportTask,
  RunEvent,
  Task,
  TaskEvent,
  TaskOutcome,
} from '../types';
import { ENV } from '../env';
import { RunLogFormatters } from '../helpers/run-log-formatters';
import { formatTimeColonDot, toLocalIso } from '../libs/utils';
import { AuditPublisherService } from './audit-publisher.service';

@Injectable()
export class RunLoggerService {
  private runDir?: string;
  private summaryPath?: string;
  private report?: RunReport;
  private taskIndex = new Map<string, number>();

  constructor(
    private readonly repoContext: RepoContextService,
    private readonly audit: AuditPublisherService,
  ) {}

  getPrSummary(): string {
    if (!this.report)
      return 'This PR was automatically created by node-droid AI automation.';
    return this.buildRunSummaryMarkdown(this.report);
  }

  scanRepos(count: number) {
    const date = toLocalIso().split('T')[0];
    console.log('-');
    console.log(`${this.colorize(date, 'date')} 🔍 Analyzing ${count} repos`);
  }

  event(emoji: string, message: string, level: RunEvent['level'] = 'INFO') {
    if (this.report) {
      this.report.events.push({ ts: Date.now(), level, message, emoji });
    }
    this.timeline(emoji, message);
    this.publishAudit('run.event', { level, emoji, message });
  }

  init(runId: string, repoId?: string, commit?: string) {
    const { aiPath } = this.repoContext.get();
    fs.mkdirSync(aiPath, { recursive: true });
    const stamp = this.formatRunStamp(new Date());
    const safeCommit = (commit || '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    const dirName = `${stamp} [${runId}] ${safeCommit || 'run'}`.trim();
    this.runDir = path.join(aiPath, dirName);
    fs.mkdirSync(this.runDir, { recursive: true });
    this.summaryPath = path.join(this.runDir, '[00] summary.md');
    this.report = {
      meta: {
        runId,
        repoId,
        commit,
        startedAt: Date.now(),
        endedAt: undefined,
        status: undefined,
        reason: undefined,
      },
      stats: {
        totalAttempts: 0,
        totalFixAttempts: 0,
        totalLLMCalls: 0,
        totalToolCalls: 0,
      },
      installResult: undefined,
      events: [],
      tasks: [],
    };
    this.taskIndex = new Map<string, number>();
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
    const fileName = targetPath ? path.basename(targetPath) : 'log';
    this.timeline('📄', `Wrote [${fileName}]`);
  }

  private timeline(emoji: string, message: string) {
    const paddedEmoji = `${emoji}  `;
    console.log(
      `${this.colorize(formatTimeColonDot(), 'time')} ${paddedEmoji}${message}`,
    );
  }

  private colorize(text: string, tone: 'date' | 'time'): string {
    const codes: Record<typeof tone, string> = {
      date: '\x1b[31m',
      time: '\x1b[90m',
    };
    return `${codes[tone]}${text}\x1b[0m`;
  }

  private colorizeStatus(status: string): string {
    const code =
      status === 'DONE'
        ? '\x1b[32m'
        : status === 'BLOCKED'
          ? '\x1b[35m'
          : '\x1b[33m';
    return `${code}${status}\x1b[0m`;
  }

  private colorizeOutcome(label: string, ok: boolean): string {
    const code = ok ? '\x1b[32m' : '\x1b[33m';
    return `${code}${label}\x1b[0m`;
  }

  private stripAnsi(value: string): string {
    return value.replace(/\u001b\[[0-9;]*m/g, '');
  }

  private emojiForLevel(level: RunEvent['level']): string {
    switch (level) {
      case 'ERROR':
        return '❌';
      case 'WARN':
        return '⚠️';
      case 'DRY':
        return '🧪';
      default:
        return 'ℹ️';
    }
  }

  section(title: string) {
    this.event('📌', title, 'INFO');
  }
  info(msg: string) {
    this.event('ℹ️', msg, 'INFO');
  }
  warn(msg: string) {
    this.event('⚠️', msg, 'WARN');
  }
  error(msg: string) {
    this.event('❌', msg, 'ERROR');
  }
  dry(msg: string) {
    this.event('🧪', msg, 'DRY');
  }

  triggerDetected(commitMessage: string, taskCount: number) {
    this.event(
      '🔬',
      `Trigger detected for commit [${commitMessage}] extract ${taskCount} tasks`,
    );
  }

  extractedTask(index: number, title: string) {
    const label = String(index).padStart(2, '0');
    this.event('💡', `Extracted Task [${label}] ${title}`);
  }

  runCreated(runId: string) {
    this.event('🚀', `Created run [${runId}]`);
    this.publishAudit('run.status', { status: 'RUNNING', runId });
  }

  checkoutBranch(branch: string) {
    this.event('📝', `Checkout branch [${branch}]`);
  }

  npmInstallOk() {
    this.event('📦', 'npm install ok');
  }

  taskOutcome(index: number, title: string, status: TaskOutcome) {
    const label = String(index).padStart(2, '0');
    if (status === 'DONE') {
      this.event(
        '✅',
        `Task [${label}] ${title} -> ${this.colorizeStatus('DONE')}`,
      );
      this.publishAudit('task.status', { index, title, status: 'DONE' });
      return;
    }
    if (status === 'BLOCKED') {
      this.event(
        '⛔',
        `Task [${label}] ${title} -> ${this.colorizeStatus('BLOCKED')}`,
      );
      this.publishAudit('task.status', { index, title, status: 'BLOCKED' });
      return;
    }
    if (status === 'DEFERRED') {
      this.event(
        '⏭️',
        `Task [${label}] ${title} -> ${this.colorizeStatus('DEFERRED')}`,
      );
      this.publishAudit('task.status', { index, title, status: 'DEFERRED' });
      return;
    }
    const out = status === 'FAILED' ? 'FAIL' : status;
    this.event('⚠️', `Task [${label}] ${title} -> ${this.colorizeStatus(out)}`);
    this.publishAudit('task.status', { index, title, status });
  }

  npmInstallResult(success: boolean, stdout: string, stderr: string) {
    if (this.report) this.report.installResult = { success, stdout, stderr };
  }

  getTaskFilesTouched(task: Task): string[] {
    const log = this.getTaskLog(task);
    return [...log.filesTouched];
  }

  setTaskProjects(
    task: Task,
    projects: Array<{ packageJson: string; name: string }>,
  ) {
    const log = this.getTaskLog(task);
    log.task.projects = projects;
  }

  private keyFor(task: Task): string {
    return task.id || task.title;
  }

  private getTaskLog(task: Task): RunReportTask {
    const key = this.keyFor(task);
    const index = this.taskIndex.get(key);
    if (index !== undefined && this.report) {
      return this.report.tasks[index];
    }
    const log: RunReportTask = {
      task,
      attempts: 0,
      fixAttempts: 0,
      llmCalls: 0,
      toolCalls: 0,
      filesTouched: [],
      events: [],
    };
    if (this.report) {
      this.report.tasks.push(log);
      this.taskIndex.set(key, this.report.tasks.length - 1);
    }
    return log;
  }

  private getTaskLabel(task: Task): string {
    const key = this.keyFor(task);
    if (!this.taskIndex.has(key)) this.getTaskLog(task);
    const idx = this.taskIndex.get(key) ?? 0;
    return String(idx + 1).padStart(2, '0');
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
    if (this.report) this.report.stats.totalAttempts++;
    log.events.push({ ts: Date.now(), kind: 'attempt', data: { n } });
    this.publishAudit('task.attempt', {
      taskId: task.id,
      title: task.title,
      attempt: n,
      phase: 'initial',
    });
  }

  taskAttemptFix(task: Task, n: number) {
    const log = this.getTaskLog(task);
    log.fixAttempts++;
    if (this.report) this.report.stats.totalFixAttempts++;
    log.events.push({ ts: Date.now(), kind: 'fix-attempt', data: { n } });
    this.publishAudit('task.attempt', {
      taskId: task.id,
      title: task.title,
      attempt: n,
      phase: 'retry',
    });
  }

  taskAnalysisPrompt(task: Task) {
    const label = this.getTaskLabel(task);
    this.event('🧭', `[${label}] Analyze Task`);
  }

  taskAnalysisResult(task: Task, analysis: string, ok: boolean) {
    const log = this.getTaskLog(task);
    const label = this.getTaskLabel(task);
    this.event('🧭', `[${label}] Analysis ${ok ? 'complete' : 'fallback'}`);
    log.events.push({
      ts: Date.now(),
      kind: 'analysis',
      data: { analysis, ok },
    });
  }

  taskLLMCall(
    task: Task,
    payload: { messages: any[]; response: any; durationMs: number },
  ) {
    const log = this.getTaskLog(task);
    log.llmCalls++;
    if (this.report) this.report.stats.totalLLMCalls++;
    log.events.push({ ts: Date.now(), kind: 'llm', data: payload });
    this.publishAudit('task.llm', {
      taskId: task.id,
      title: task.title,
      durationMs: payload.durationMs,
      usage: payload.response?.usage,
      toolCalls: Array.isArray(payload.response?.tool_calls)
        ? payload.response.tool_calls.length
        : 0,
    });
  }

  taskToolCall(
    task: Task,
    payload: { name: string; args: any; result: any; durationMs: number },
  ) {
    const log = this.getTaskLog(task);
    const label = this.getTaskLabel(task);
    const argsText = this.formatToolArgs(payload.name, payload.args);
    this.event(
      '🛠️',
      `[${label}] LLM Use Tool [${payload.name}]${argsText ? ` ${argsText}` : ''}`,
    );
    log.toolCalls++;
    if (this.report) this.report.stats.totalToolCalls++;
    if (payload.args?.path && this.isWriteTool(payload.name)) {
      if (!log.filesTouched.includes(payload.args.path)) {
        log.filesTouched.push(payload.args.path);
      }
    }
    log.events.push({ ts: Date.now(), kind: 'tool', data: payload });
    this.publishAudit('task.tool', {
      taskId: task.id,
      title: task.title,
      name: payload.name,
      args: payload.args,
      success: payload.result?.success,
      durationMs: payload.durationMs,
    });
  }

  private formatToolArgs(name: string, args: any): string {
    if (!args || typeof args !== 'object') return '';
    switch (name) {
      case 'read_file':
        return args.path ? `path=${args.path}` : '';
      case 'read_file_range':
        return args.path
          ? `path=${args.path} lines=${args.startLine}-${args.endLine}`
          : '';
      case 'create_file':
        return args.path ? `path=${args.path}` : '';
      case 'replace_in_file':
        return args.path ? `path=${args.path}` : '';
      case 'insert_in_file':
        return args.path ? `path=${args.path}` : '';
      case 'save_file':
        return args.path ? `path=${args.path}` : '';
      case 'get_folder_content':
        return args.path ? `path=${args.path}` : '';
      case 'search':
        return args.query ? `query="${args.query}"` : '';
      case 'search_file':
        return args.query ? `query="${args.query}"` : '';
      default:
        return '';
    }
  }

  taskBuildResult(
    task: Task,
    payload: { phase: 'initial' | 'retry'; result: BuildResult },
  ) {
    const log = this.getTaskLog(task);
    const label = this.getTaskLabel(task);
    const buildLabel = payload.result.success ? 'SUCCESS' : 'FAIL';
    this.event(
      '🏗️',
      `[${label}] Check Build -> ${this.colorizeOutcome(buildLabel, payload.result.success)}`,
    );
    log.events.push({ ts: Date.now(), kind: 'build', data: payload });
    this.publishAudit('task.build', {
      taskId: task.id,
      title: task.title,
      phase: payload.phase,
      success: payload.result.success,
      exitCode: payload.result.exitCode,
      durationMs: payload.result.durationMs,
    });
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

  taskBlocked(task: Task) {
    const log = this.getTaskLog(task);
    log.endTs = Date.now();
    log.status = 'BLOCKED';
    log.events.push({ ts: Date.now(), kind: 'blocked', data: task.blocker });
  }

  taskDeferred(task: Task, reason: string) {
    const log = this.getTaskLog(task);
    log.endTs = Date.now();
    log.status = 'DEFERRED';
    log.events.push({ ts: Date.now(), kind: 'deferred', data: { reason } });
  }

  taskBlocksPlanned(blocks: Array<{ title: string; tasks: Task[] }>) {
    this.event(
      '🧱',
      `Planned ${blocks.length} task block${blocks.length === 1 ? '' : 's'}`,
    );
    blocks.forEach((block, index) => {
      this.event(
        '🧱',
        `Block [${String(index + 1).padStart(2, '0')}] ${block.title} (${block.tasks.length} task${block.tasks.length === 1 ? '' : 's'})`,
      );
    });
  }

  taskBlockStart(index: number, title: string) {
    this.event(
      '🧱',
      `Start block [${String(index).padStart(2, '0')}] ${title}`,
    );
  }

  taskBlockStop(index: number, title: string, reason: string) {
    this.event(
      '⛔',
      `Stop after block [${String(index).padStart(2, '0')}] ${title}: ${reason}`,
      'WARN',
    );
  }

  writeDeferredTaskBlocks(
    blocks: Array<{ title: string; targetDir: string; tasks: Task[] }>,
    reason: string,
  ) {
    if (!this.runDir || !blocks.length) return;
    const dir = path.join(this.runDir, 'deferred-task-blocks');
    fs.mkdirSync(dir, { recursive: true });
    blocks.forEach((block, index) => {
      const safeTitle =
        (block.title || 'task-block')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 80) || 'task-block';
      const filePath = path.join(
        dir,
        `[${String(index + 1).padStart(2, '0')}] ${safeTitle}.md`,
      );
      this.write(filePath, this.renderDeferredTaskBlock(block, reason));
    });
  }

  private renderDeferredTaskBlock(
    block: { title: string; targetDir: string; tasks: Task[] },
    reason: string,
  ): string {
    const destination =
      block.targetDir === '.'
        ? ENV.AI_TODO_FILE
        : `${block.targetDir}/${ENV.AI_TODO_FILE}`;
    const lines: string[] = [];
    lines.push(`# Deferred Task Block: ${block.title}`);
    lines.push('');
    lines.push(`Suggested destination: \`${destination}\``);
    lines.push(`Reason: ${reason}`);
    lines.push('');
    lines.push('## AI Tasks');
    lines.push('');
    for (const task of block.tasks) {
      const description = (task.description || '').trim();
      lines.push(
        description ? `- ${task.title} | ${description}` : `- ${task.title}`,
      );
    }
    lines.push('');
    return lines.join('\n');
  }

  taskRetryPrompt(task: Task) {
    const label = this.getTaskLabel(task);
    this.event('🧠', `[${label}] Prompt to Build Issue`);
  }

  llmResult(task: Task, ok: boolean) {
    const label = this.getTaskLabel(task);
    const labelText = ok ? 'COMPLETE' : 'FAIL';
    this.event(
      '🏁',
      `[${label}] LLM Result -> ${this.colorizeOutcome(labelText, ok)}`,
    );
  }

  promptToLLM(task: Task) {
    const label = this.getTaskLabel(task);
    this.event('🧠', `[${label}] Prompt to LLM`);
  }

  // ---- Run lifecycle ----

  runInterrupted(reason = 'Shutdown requested') {
    if (this.report) {
      this.report.meta.status = 'INTERRUPTED';
      this.report.meta.reason = reason;
      this.report.meta.endedAt = Date.now();
    }
    this.publishAudit('run.status', { status: 'INTERRUPTED', reason });
    this.flush();
  }

  runCompleted() {
    if (this.report) {
      this.report.meta.status = 'COMPLETED';
      this.report.meta.endedAt = Date.now();
    }
    this.publishAudit('run.status', { status: 'COMPLETED' });
    this.flush();
  }

  runFailed(reason?: string) {
    if (this.report) {
      this.report.meta.status = 'FAILED';
      this.report.meta.reason = reason;
      this.report.meta.endedAt = Date.now();
    }
    this.publishAudit('run.status', { status: 'FAILED', reason });
    this.flush();
  }

  private publishAudit(
    type:
      | 'run.event'
      | 'run.status'
      | 'task.status'
      | 'task.attempt'
      | 'task.build'
      | 'task.tool'
      | 'task.llm',
    payload: Record<string, any>,
  ) {
    void this.audit.publish(type, payload).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.timeline('📡', `MQTT audit publish failed [${type}] ${message}`);
    });
  }

  private isWriteTool(name: string): boolean {
    return (
      name === 'save_file' ||
      name === 'create_file' ||
      name === 'replace_in_file' ||
      name === 'insert_in_file'
    );
  }

  private flush() {
    if (!this.report) return;
    const summary = this.buildRunSummaryMarkdown(this.report);
    this.write(this.summaryPath, summary);

    for (let i = 0; i < this.report.tasks.length; i++) {
      const log = this.report.tasks[i];
      const taskMd = this.buildTaskMarkdown(log, i + 1);
      const taskPath = this.runDir
        ? path.join(this.runDir, this.getTaskFileName(log, i + 1))
        : undefined;
      this.write(taskPath, taskMd);
    }
  }

  private getTaskDuration(log: RunReportTask): number {
    if (!log.startTs) return 0;
    const end = log.endTs || Date.now();
    return end - log.startTs;
  }

  private getAllTouchedFiles(report: RunReport): string[] {
    const out = new Set<string>();
    for (const log of report.tasks) {
      for (const f of log.filesTouched) out.add(f);
    }
    return Array.from(out);
  }

  private buildRunSummaryMarkdown(report: RunReport): string {
    const lines: string[] = [];
    const startedAt = new Date(report.meta.startedAt);
    const endedAt = report.meta.endedAt
      ? new Date(report.meta.endedAt)
      : new Date();
    const titleParts = [report.meta.runId, report.meta.commit].filter(Boolean);
    lines.push(`# 🚀 Run ${titleParts.join(' - ')}`.trim());
    //if (report.meta.repoId) lines.push(`Repo: ${report.meta.repoId}`);
    lines.push(`Started: **${RunLogFormatters.formatDateTime(startedAt)}**`);
    lines.push(`Ended: **${RunLogFormatters.formatDateTime(endedAt)}**`);
    lines.push(`Status: **${report.meta.status || 'UNKNOWN'}**`);
    lines.push(
      `Total duration: **${RunLogFormatters.formatDuration(endedAt.getTime() - startedAt.getTime())}**`,
    );
    lines.push(`LLM model: **${ENV.LLM_MODEL}**`);
    lines.push('');

    lines.push('### ✅ Tasks');
    lines.push(
      '| Task | Status | Duration | Attempts | Fix Attempts | LLM Calls | Tool Calls | Files Touched |',
    );
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const log of report.tasks) {
      const duration = RunLogFormatters.formatDuration(
        this.getTaskDuration(log),
      );
      const files = log.filesTouched.join(', ');
      lines.push(
        `| ${RunLogFormatters.escapePipes(log.task.title)} | **${log.status || 'UNKNOWN'}** | ${duration} | ${log.attempts} | ${log.fixAttempts} | ${log.llmCalls} | ${log.toolCalls} | ${RunLogFormatters.escapePipes(files || '-')} |`,
      );
    }

    const touchedFiles = this.getAllTouchedFiles(report);
    if (touchedFiles.length) {
      lines.push('### 📝 Files touched');
      for (const f of touchedFiles) {
        lines.push(`- ${RunLogFormatters.escapePipes(f)}`);
      }
      lines.push('');
    }

    if (report.installResult) {
      lines.push('');
      lines.push('## 📦 Install');
      lines.push(
        `Status: ${report.installResult.success ? '✅ **Success**' : '❌ **Failed**'}`,
      );
      if (report.installResult.stdout) {
        lines.push('');
        lines.push('```');
        lines.push(report.installResult.stdout);
        lines.push('```');
      }
      if (report.installResult.stderr) {
        lines.push('');
        lines.push('```');
        lines.push(report.installResult.stderr);
        lines.push('```');
      }
    }

    if (report.events.length) {
      lines.push('');
      lines.push('## 🧭 Run Events');
      for (const ev of report.events) {
        const time = formatTimeColonDot(new Date(ev.ts));
        const emoji = ev.emoji || this.emojiForLevel(ev.level);
        const cleanMessage = this.stripAnsi(ev.message);
        lines.push(
          `- ${time} ${emoji} ${RunLogFormatters.escapePipes(cleanMessage)}`,
        );
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  private getTaskFileName(log: RunReportTask, index: number): string {
    const base = (log.task.title || log.task.id || 'task')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return `[${String(index).padStart(2, '0')}] ${base || 'task'}.md`;
  }

  private buildTaskMarkdown(log: RunReportTask, index: number): string {
    const lines: string[] = [];
    lines.push(`# ${log.task.title}`);
    lines.push('');
    lines.push('## 🎯 Task');
    lines.push('');
    lines.push(`- Number: ${index}`);
    lines.push(`- Title: ${log.task.title}`);
    lines.push(`- Description: ${log.task.description || '-'}`);
    if (log.task.source) lines.push(`- Source: ${log.task.source}`);
    if (log.task.file) lines.push(`- File: **${log.task.file}**`);
    if (log.task.line) lines.push(`- Line: ${log.task.line}`);
    lines.push('');
    if (log.task.projects?.length) {
      lines.push('## Projects');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify({ projects: log.task.projects }, null, 2));
      lines.push('```');
      lines.push('');
    }

    const analysisEvents = log.events.filter((e) => e.kind === 'analysis');
    if (analysisEvents.length) {
      lines.push('## 🧭 Analysis');
      lines.push('');
      const latest = analysisEvents[analysisEvents.length - 1];
      lines.push(latest.data?.analysis || '_No analysis captured_');
      lines.push('');
    }

    lines.push('## Files Touched');
    lines.push('');
    const filesTouched = log.filesTouched;
    if (!filesTouched.length) {
      lines.push('_No files touched_');
    } else {
      lines.push(filesTouched.map((f) => `- ${f}`).join('\n'));
    }
    lines.push('');

    lines.push('## 📊 LLM Stats');
    lines.push('');
    const llmEvents = log.events.filter((e) => e.kind === 'llm');
    if (!llmEvents.length) {
      lines.push('_No LLM calls_');
      lines.push('');
    } else {
      const last = llmEvents[llmEvents.length - 1];
      const totalTokens = llmEvents.reduce(
        (sum, e) => sum + (e.data?.response?.usage?.total_tokens || 0),
        0,
      );
      lines.push(`- Total calls: ${llmEvents.length}`);
      lines.push(
        `- Total duration: ${RunLogFormatters.formatDuration(llmEvents.reduce((s, e) => s + (e.data?.durationMs || 0), 0))}`,
      );
      if (totalTokens) lines.push(`- Total tokens: ${totalTokens}`);
      lines.push('');
      lines.push('## 🧠 LLM Conversation');
      lines.push('');
      lines.push(...this.renderConversation(last.data?.messages || []));
      lines.push('');
    }

    lines.push('## 🏁 Outcome');
    lines.push('');
    lines.push(`- Status: ${log.status || 'UNKNOWN'}`);
    lines.push(`- Result: ${log.task.result || '-'}`);
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
    const content =
      typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content || '', null, 2);
    return [content];
  }

  private renderUserMessage(msg: any): string[] {
    const content =
      typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content || '', null, 2);
    return [content];
  }

  private renderAssistantMessage(
    msg: any,
    toolOutputs: Map<string, any>,
  ): string[] {
    const lines: string[] = [];
    if (msg.content) {
      lines.push('***');
      lines.push(
        typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content, null, 2),
      );
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
        lines.push(`- 🗂️ Path: **${path}**`);
        if (
          (fnName === 'save_file' || fnName === 'create_file') &&
          typeof args?.content === 'string'
        ) {
          lines.push('');
          lines.push(...this.renderSavedFileBlock(path, args.content));
        }
        lines.push('');
        const toolMsg = toolOutputs.get(call.id);
        const rendered = this.renderToolOutput(toolMsg, fnName);
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
      if (msg.name === 'read_file' || msg.name === 'read_file_range') {
        lines.push('[read_file output omitted]');
      } else {
        lines.push(['```json', this.safeJson(content), '```'].join('\n'));
      }
    }
    return lines.length ? lines : ['_Empty tool message_'];
  }

  private renderFinalResponse(response: any): string[] {
    return ['```json', JSON.stringify(response, null, 2), '```'];
  }

  private renderToolOutput(toolMsg: any, toolName?: string): string[] {
    if (!toolMsg) {
      return ['### ❓ Output', '```\n_no output captured_\n```'];
    }
    const parsed = this.safeJsonParse(toolMsg.content);
    const success =
      typeof parsed?.success === 'boolean' ? parsed.success : undefined;
    const emoji = success === false ? '❌' : '✅';
    const output =
      parsed?.output !== undefined ? parsed.output : toolMsg.content;
    if (toolName === 'read_file' || toolName === 'read_file_range') {
      return [
        `### ${emoji} Output`,
        '```',
        '[read_file output omitted]',
        '```',
      ];
    }
    const outText =
      typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    return [`### ${emoji} Output`, '```', outText, '```'];
  }

  private renderSavedFileBlock(filePath: string, content: string): string[] {
    const ext = path.extname(filePath || '').toLowerCase();
    const language = this.getLanguageForExtension(ext);
    return [`\`\`\`${language}`, content, '```'];
  }

  private getLanguageForExtension(ext: string): string {
    const map: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'tsx',
      '.js': 'javascript',
      '.jsx': 'jsx',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.sh': 'bash',
      '.bash': 'bash',
      '.zsh': 'zsh',
      '.py': 'python',
      '.rb': 'ruby',
      '.php': 'php',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.json': 'json',
      '.xml': 'xml',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.sql': 'sql',
      '.md': 'markdown',
      '.txt': 'text',
      '.toml': 'toml',
      '.ini': 'ini',
    };
    return map[ext] || '';
  }

  private functionEmoji(name: string): string {
    switch (name) {
      case 'read_file':
        return '📖';
      case 'read_file_range':
        return '📑';
      case 'list_files':
        return '📂';
      case 'get_folder_content':
        return '📂';
      case 'create_file':
        return '🆕';
      case 'replace_in_file':
        return '✏️';
      case 'insert_in_file':
        return '➕';
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
}
