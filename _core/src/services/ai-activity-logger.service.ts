import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ActivityMetrics, TaskMetrics } from '../interfaces';

const execAsync = promisify(exec);

@Injectable()
export class AIActivityLoggerService {
  repoPath = "";
  activityDir = "";
  private currentActivity: ActivityMetrics | null = null;
  private currentActivityFile: string | null = null;
  private logBuffer: string[] = [];

  async initializeActivity(commitHash: string, commitMessage: string, baseBranch: string,repoName: string,repoPath: string) {
    this.repoPath = repoPath;
    this.activityDir = path.join(repoPath, '.ai-activity');
    // Crea directory se non esiste
    await fs.mkdir(this.activityDir, { recursive: true });

    const timestamp = this.formatTimestamp(new Date());
    const sanitizedMessage = commitMessage
      .replace(/^\[AI\]\s*/i, '')
      .substring(0, 50)
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    
    const fileName = `${timestamp} - ${commitHash.substring(0, 7)} - ${sanitizedMessage}.md`;
    this.currentActivityFile = path.join(this.activityDir, fileName);

    this.currentActivity = {
      startTime: new Date(),
      commitHash,
      commitMessage,
      baseBranch,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalFilesChanged: 0,
      totalFilesCreated: 0,
      totalFilesDeleted: 0,
      totalLinesAdded: 0,
      totalLinesRemoved: 0,
      tasks: [],
      errors: []
    };

    this.logBuffer = [];
    await this.writeHeader();
    
    this.log('info', `🤖 node-droid activity started`);
    this.log('info', `Commit: ${commitHash.substring(0, 7)}`);
    this.log('info', `Message: ${commitMessage}`);
    this.log('info', `Base branch: ${baseBranch}`);
  }

  setAIBranch(branchName: string) {
    if (this.currentActivity) {
      this.currentActivity.aiBranch = branchName;
      this.log('info', `Created AI branch: ${branchName}`);
    }
  }

  setTotalTasks(count: number) {
    if (this.currentActivity) {
      this.currentActivity.totalTasks = count;
      this.log('info', `Total tasks to execute: ${count}`);
    }
  }

  async startTask(taskNumber: number, description: string): Promise<number> {
    const taskMetrics: TaskMetrics = {
      taskNumber,
      description,
      startTime: new Date(),
      status: 'running',
      filesChanged: [],
      filesCreated: [],
      filesDeleted: [],
      linesAdded: 0,
      linesRemoved: 0,
      affectedPackages: [],
      llmCalls: 0,
      toolCalls: []
    };

    this.currentActivity?.tasks.push(taskMetrics);
    
    this.log('section', `\n${'='.repeat(80)}`);
    this.log('task', `📌 TASK ${taskNumber}/${this.currentActivity?.totalTasks}: ${description}`);
    this.log('section', `${'='.repeat(80)}\n`);

    return this.currentActivity!.tasks.length - 1;
  }

  async logToolCall(taskIndex: number, toolName: string, args: any, startTime: Date, success: boolean) {
    const task = this.currentActivity?.tasks[taskIndex];
    if (!task) return;

    const durationMs = Date.now() - startTime.getTime();
    
    task.toolCalls.push({
      toolName,
      arguments: args,
      timestamp: startTime,
      durationMs,
      success
    });

    const icon = success ? '✅' : '❌';
    this.log('tool', `${icon} Tool: ${toolName} (${durationMs}ms)`);
    
    // Log degli argomenti in modo compatto
    if (toolName === 'read_file') {
      this.log('detail', `   📖 Reading: ${args.path}`);
    } else if (toolName === 'write_file') {
      this.log('detail', `   ✍️  Writing: ${args.path} (${args.content?.length || 0} chars)`);
    } else if (toolName === 'list_directory') {
      this.log('detail', `   📁 Listing: ${args.path}`);
    } else {
      this.log('detail', `   Args: ${JSON.stringify(args).substring(0, 100)}...`);
    }
  }

  incrementLLMCalls(taskIndex: number) {
    const task = this.currentActivity?.tasks[taskIndex];
    if (task) {
      task.llmCalls++;
      this.log('llm', `🤖 LLM call #${task.llmCalls}`);
    }
  }

  async endTask(
    taskIndex: number,
    success: boolean,
    affectedPackages: string[],
    buildSuccess?: boolean,
    testSuccess?: boolean,
    lintSuccess?: boolean,
    error?: string
  ) {
    const task = this.currentActivity?.tasks[taskIndex];
    if (!task) return;

    task.endTime = new Date();
    task.durationMs = task.endTime.getTime() - task.startTime.getTime();
    task.status = success ? 'success' : 'failed';
    task.affectedPackages = affectedPackages;
    task.buildSuccess = buildSuccess;
    task.testSuccess = testSuccess;
    task.lintSuccess = lintSuccess;
    task.error = error;

    // Calcola le modifiche ai file
    await this.calculateTaskFileChanges(taskIndex);

    // Update totali
    if (success) {
      this.currentActivity!.completedTasks++;
    } else {
      this.currentActivity!.failedTasks++;
      if (error) {
        this.currentActivity!.errors.push(`Task ${task.taskNumber}: ${error}`);
      }
    }

    // Log del risultato
    this.log('section', `\n${'-'.repeat(80)}`);
    this.log('info', `📊 Task ${task.taskNumber} Summary:`);
    this.log('info', `   Status: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
    this.log('info', `   Duration: ${this.formatDuration(task.durationMs!)}`);
    this.log('info', `   Files changed: ${task.filesChanged.length}`);
    this.log('info', `   Files created: ${task.filesCreated.length}`);
    this.log('info', `   Lines added: +${task.linesAdded}`);
    this.log('info', `   Lines removed: -${task.linesRemoved}`);
    this.log('info', `   LLM calls: ${task.llmCalls}`);
    this.log('info', `   Tool calls: ${task.toolCalls.length}`);
    
    if (affectedPackages.length > 0) {
      this.log('info', `   Affected packages: ${affectedPackages.join(', ')}`);
      if (buildSuccess !== undefined) {
        this.log('info', `   Build: ${buildSuccess ? '✅ PASSED' : '❌ FAILED'}`);
      }
      if (testSuccess !== undefined) {
        this.log('info', `   Tests: ${testSuccess ? '✅ PASSED' : '❌ FAILED'}`);
      }
      if (lintSuccess !== undefined) {
        this.log('info', `   Lint: ${lintSuccess ? '✅ PASSED' : '⚠️  WARNINGS'}`);
      }
    }
    
    if (error) {
      this.log('error', `   Error: ${error}`);
    }
    
    this.log('section', `${'-'.repeat(80)}\n`);

    await this.flush();
  }

  async finalizeActivity() {
    if (!this.currentActivity) return;

    this.currentActivity.endTime = new Date();
    this.currentActivity.durationMs = 
      this.currentActivity.endTime.getTime() - this.currentActivity.startTime.getTime();

    // Calcola totali globali
    this.currentActivity.totalFilesChanged = new Set(
      this.currentActivity.tasks.flatMap(t => t.filesChanged)
    ).size;
    
    this.currentActivity.totalFilesCreated = new Set(
      this.currentActivity.tasks.flatMap(t => t.filesCreated)
    ).size;
    
    this.currentActivity.totalFilesDeleted = new Set(
      this.currentActivity.tasks.flatMap(t => t.filesDeleted)
    ).size;

    this.currentActivity.totalLinesAdded = this.currentActivity.tasks.reduce(
      (sum, t) => sum + t.linesAdded, 0
    );
    
    this.currentActivity.totalLinesRemoved = this.currentActivity.tasks.reduce(
      (sum, t) => sum + t.linesRemoved, 0
    );

    // Log finale
    this.log('section', `\n${'='.repeat(80)}`);
    this.log('section', `🏁 node-droid ACTIVITY COMPLETED`);
    this.log('section', `${'='.repeat(80)}\n`);
    
    this.log('info', `📊 Overall Summary:`);
    this.log('info', `   Total duration: ${this.formatDuration(this.currentActivity.durationMs)}`);
    this.log('info', `   Tasks completed: ${this.currentActivity.completedTasks}/${this.currentActivity.totalTasks}`);
    this.log('info', `   Tasks failed: ${this.currentActivity.failedTasks}`);
    this.log('info', `   Files changed: ${this.currentActivity.totalFilesChanged}`);
    this.log('info', `   Files created: ${this.currentActivity.totalFilesCreated}`);
    this.log('info', `   Files deleted: ${this.currentActivity.totalFilesDeleted}`);
    this.log('info', `   Lines added: +${this.currentActivity.totalLinesAdded}`);
    this.log('info', `   Lines removed: -${this.currentActivity.totalLinesRemoved}`);
    
    const totalLLMCalls = this.currentActivity.tasks.reduce((sum, t) => sum + t.llmCalls, 0);
    const totalToolCalls = this.currentActivity.tasks.reduce((sum, t) => sum + t.toolCalls.length, 0);
    
    this.log('info', `   Total LLM calls: ${totalLLMCalls}`);
    this.log('info', `   Total tool calls: ${totalToolCalls}`);

    if (this.currentActivity.errors.length > 0) {
      this.log('section', `\n❌ Errors encountered:`);
      this.currentActivity.errors.forEach((err, i) => {
        this.log('error', `   ${i + 1}. ${err}`);
      });
    }

    await this.flush();
    await this.updateHeader();

    // Reset
    this.currentActivity = null;
    this.currentActivityFile = null;
    this.logBuffer = [];
  }

  log(level: 'info' | 'error' | 'task' | 'tool' | 'llm' | 'detail' | 'section', message: string) {
    // Log in console
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);
    const prefix = level === 'section' ? '' : `[${timestamp}] `;
    console.log(`${prefix}${message}`);

    // Aggiungi al buffer per il file
    this.logBuffer.push(message);
  }

  private async flush() {
    if (!this.currentActivityFile || this.logBuffer.length === 0) return;

    const content = this.logBuffer.join('\n') + '\n';
    await fs.appendFile(this.currentActivityFile, content, 'utf-8');
    this.logBuffer = [];
  }

  private async writeHeader() {
    if (!this.currentActivityFile || !this.currentActivity) return;

    const header = `# node-droid Activity Log

## 📋 Execution Info

- **Started:** ${this.currentActivity.startTime.toISOString()}
- **Commit Hash:** \`${this.currentActivity.commitHash}\`
- **Commit Message:** ${this.currentActivity.commitMessage}
- **Base Branch:** \`${this.currentActivity.baseBranch}\`
- **Status:** 🔄 Running...

## 📊 Telemetry (Updated on completion)

| Metric | Value |
|--------|-------|
| Duration | - |
| Tasks Total | - |
| Tasks Completed | - |
| Tasks Failed | - |
| Files Changed | - |
| Files Created | - |
| Files Deleted | - |
| Lines Added | - |
| Lines Removed | - |
| LLM Calls | - |
| Tool Calls | - |

---

## 📝 Execution Log

`;

    await fs.writeFile(this.currentActivityFile, header, 'utf-8');
  }

  private async updateHeader() {
    if (!this.currentActivityFile || !this.currentActivity) return;

    const content = await fs.readFile(this.currentActivityFile, 'utf-8');
    const logStartIndex = content.indexOf('## 📝 Execution Log');
    const executionLog = content.substring(logStartIndex);

    const totalLLMCalls = this.currentActivity.tasks.reduce((sum, t) => sum + t.llmCalls, 0);
    const totalToolCalls = this.currentActivity.tasks.reduce((sum, t) => sum + t.toolCalls.length, 0);

    const status = this.currentActivity.failedTasks > 0 
      ? `❌ Completed with ${this.currentActivity.failedTasks} failure(s)`
      : '✅ Completed successfully';

    const header = `# node-droid Activity Log

## 📋 Execution Info

- **Started:** ${this.currentActivity.startTime.toISOString()}
- **Completed:** ${this.currentActivity.endTime?.toISOString()}
- **Duration:** ${this.formatDuration(this.currentActivity.durationMs!)}
- **Commit Hash:** \`${this.currentActivity.commitHash}\`
- **Commit Message:** ${this.currentActivity.commitMessage}
- **Base Branch:** \`${this.currentActivity.baseBranch}\`
- **AI Branch:** \`${this.currentActivity.aiBranch || 'N/A'}\`
- **Status:** ${status}

## 📊 Global Telemetry

| Metric | Value |
|--------|-------|
| **Duration** | ${this.formatDuration(this.currentActivity.durationMs!)} |
| **Tasks Total** | ${this.currentActivity.totalTasks} |
| **Tasks Completed** | ${this.currentActivity.completedTasks} ✅ |
| **Tasks Failed** | ${this.currentActivity.failedTasks} ❌ |
| **Files Changed** | ${this.currentActivity.totalFilesChanged} |
| **Files Created** | ${this.currentActivity.totalFilesCreated} |
| **Files Deleted** | ${this.currentActivity.totalFilesDeleted} |
| **Lines Added** | +${this.currentActivity.totalLinesAdded} |
| **Lines Removed** | -${this.currentActivity.totalLinesRemoved} |
| **LLM Calls** | ${totalLLMCalls} |
| **Tool Calls** | ${totalToolCalls} |

## 📋 Tasks Breakdown

${this.generateTasksTable()}

---

`;

    await fs.writeFile(this.currentActivityFile, header + executionLog, 'utf-8');
  }

  private generateTasksTable(): string {
    if (!this.currentActivity) return '';

    let table = `| # | Description | Duration | Status | Files | Lines | LLM | Tools | Packages |\n`;
    table += `|---|-------------|----------|--------|-------|-------|-----|-------|----------|\n`;

    for (const task of this.currentActivity.tasks) {
      const statusIcon = task.status === 'success' ? '✅' : task.status === 'failed' ? '❌' : '🔄';
      const duration = task.durationMs ? this.formatDuration(task.durationMs) : '-';
      const files = task.filesChanged.length + task.filesCreated.length + task.filesDeleted.length;
      const lines = `+${task.linesAdded}/-${task.linesRemoved}`;
      const packages = task.affectedPackages.join(', ') || '-';
      const desc = task.description.length > 40 ? task.description.substring(0, 40) + '...' : task.description;
      
      table += `| ${task.taskNumber} | ${desc} | ${duration} | ${statusIcon} | ${files} | ${lines} | ${task.llmCalls} | ${task.toolCalls.length} | ${packages} |\n`;
    }

    return table;
  }

  private async calculateTaskFileChanges(taskIndex: number) {
    const task = this.currentActivity?.tasks[taskIndex];
    if (!task) return;

    try {
      // Ottieni le modifiche dall'ultimo commit
      const { stdout: diffStat } = await execAsync(
        'git diff --numstat HEAD~1 HEAD',
        { cwd: this.repoPath }
      );

      const lines = diffStat.split('\n').filter(Boolean);
      
      for (const line of lines) {
        const [added, removed, file] = line.split('\t');
        
        if (added === '-' && removed === '-') {
          // File binario o rinominato
          task.filesChanged.push(file);
          continue;
        }

        const addedNum = parseInt(added, 10) || 0;
        const removedNum = parseInt(removed, 10) || 0;

        if (addedNum > 0 && removedNum === 0) {
            task.filesCreated.push(file);
    } else if (addedNum === 0 && removedNum > 0) {
      task.filesDeleted.push(file);
    } else {
      task.filesChanged.push(file);
    }

    task.linesAdded += addedNum;
    task.linesRemoved += removedNum;
  }
} catch (error) {
  this.log('error', `Failed to calculate file changes: ${error.message}`);
}
  }

  private formatTimestamp(date: Date): string {
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
const hours = String(date.getHours()).padStart(2, '0');
const minutes = String(date.getMinutes()).padStart(2, '0');
const seconds = String(date.getSeconds()).padStart(2, '0');

return `${year}-${month}-${day} ${hours}.${minutes}.${seconds}`;
  }

  private formatDuration(ms: number): string {
const seconds = Math.floor(ms / 1000);
const minutes = Math.floor(seconds / 60);
const hours = Math.floor(minutes / 60);
if (hours > 0) {
  return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
} else if (minutes > 0) {
  return `${minutes}m ${seconds % 60}s`;
} else {
  return `${seconds}s`;
}

}
}