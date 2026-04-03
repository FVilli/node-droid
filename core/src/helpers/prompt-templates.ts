import { ENV } from '../env';
import { ContextPolicy } from '../services/context-file.service';

export class PromptTemplates {
  static render(name: string, params: any): string {
    switch (name) {
      case 'task-extraction':
        return `Extract tasks from:\n${params.content}`;
      case 'task-execution':
        return this.renderTaskExecution(params.task, params.contextPolicy);
      case 'task-retry':
        return this.renderTaskRetry(params.task, params.result, params.error, params.contextPolicy);
      default:
        throw new Error(`Unknown template: ${name}`);
    }
  }

  private static renderTaskExecution(task: any, contextPolicy?: ContextPolicy): string {
    const title = task?.title || '';
    const description = task?.description || '';
    const file = task?.file || '';
    const isMdTask = task?.source === 'md' || (file && file.endsWith(ENV.AI_TODO_FILE));
    const folder = file.substring(0, file.lastIndexOf('/')) || '.';
    const lines: string[] = [];
    lines.push('## Objective');
    lines.push(title || 'No title provided.');
    if (description) {
      lines.push('');
      lines.push('## Details');
      lines.push(description);
    }
    lines.push('');
    lines.push('## Task Context');
    lines.push(`- Source file: ${file || '-'}`);
    if (isMdTask) {
      lines.push(`- Working directory: ${folder}`);
      lines.push('- The task comes from a markdown task file. Inspect the surrounding folder to find the real implementation files.');
    } else {
      lines.push('- Treat the referenced file as the primary target unless the code requires small supporting changes elsewhere.');
    }
    lines.push('');
    lines.push('## Expectations');
    lines.push(`- Check whether relevant \`${ENV.AI_CONTEXT_FILE}\` files already exist in the repo root or target folders.`);
    lines.push('- Inspect the relevant files before editing.');
    lines.push('- Prefer focused reads and targeted edits over rewriting full files.');
    lines.push('- Keep the scope minimal and aligned with the task.');
    if (contextPolicy?.shouldBootstrap) {
      lines.push(`- No local \`${ENV.AI_CONTEXT_FILE}\` exists for \`${contextPolicy.targetDir}\`. If recurring local context would help, you may bootstrap it.`);
    } else {
      lines.push(`- Reuse the existing local \`${ENV.AI_CONTEXT_FILE}\` for \`${contextPolicy?.targetDir || folder}\` before creating new context.`);
    }
    if (contextPolicy?.allowRefresh) {
      lines.push(`- If the task changes useful local knowledge, you may refresh and compact \`${ENV.AI_CONTEXT_FILE}\` after the task.`);
    }
    lines.push(`- Keep \`${ENV.AI_CONTEXT_FILE}\` concise and aligned with the official template from the system prompt.`);
    lines.push('- When done, return a short summary of the completed change.');
    return lines.join('\n');
  }

  private static renderTaskRetry(task: any, result: string | undefined, error: string | undefined, contextPolicy?: ContextPolicy): string {
    const lines: string[] = [];
    lines.push('## Retry Objective');
    lines.push('The previous implementation attempt did not pass validation. Fix only what is necessary to make the task pass the build.');
    lines.push('');
    lines.push('## Task');
    lines.push('```json');
    lines.push(JSON.stringify(task, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('## Previous Attempt Summary');
    lines.push(result || 'No summary provided.');
    lines.push('');
    lines.push('## Build Failure');
    lines.push('```text');
    lines.push(error || 'Build failed with no output.');
    lines.push('```');
    lines.push('');
    lines.push('## Retry Rules');
    lines.push('- Identify the root cause from the build failure.');
    lines.push('- Apply the smallest fix that addresses the failure.');
    lines.push('- Do not redo unrelated parts of the task.');
    lines.push('- If the failure is caused by a missing dependency or another external requirement, stop and mark the task as BLOCKED.');
    lines.push('- Use the exact BLOCKED format required by the system prompt.');
    if (contextPolicy?.allowRefresh) {
      lines.push(`- Refresh and compact \`${ENV.AI_CONTEXT_FILE}\` only if the retry revealed a useful local rule, correction, or gotcha worth preserving.`);
    } else {
      lines.push(`- Do not spend time creating or updating \`${ENV.AI_CONTEXT_FILE}\` during this retry unless it is truly necessary to complete the task.`);
    }
    lines.push('- When done, return a short summary of the fix.');
    return lines.join('\n');
  }
}
