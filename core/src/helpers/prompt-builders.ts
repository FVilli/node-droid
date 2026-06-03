import { ENV } from '../env';

export class PromptBuilders {
  static buildAnalysisSystem(instructions: string | null): string {
    const blocks: string[] = [];

    blocks.push('## Role');
    blocks.push(
      'You are an expert software agent analyzing a task before implementation.',
    );

    blocks.push('## Goal');
    blocks.push(
      '- Understand the task objective and the repository context before any code change.',
    );
    blocks.push(
      '- Produce an observable execution plan that another agent can follow.',
    );
    blocks.push(
      '- You may inspect files with read-only tools, but you must not modify files during analysis.',
    );

    blocks.push('## Analysis Rules');
    blocks.push('- Start from the task objective and constraints.');
    blocks.push(
      '- Inspect only the relevant files needed to understand the context.',
    );
    blocks.push(
      '- Identify local patterns, rules, risks, and completion criteria.',
    );
    blocks.push('- Keep the plan small, concrete, and ordered.');
    blocks.push(
      '- If the task is blocked by missing access, dependency, or requirement, say so clearly.',
    );

    blocks.push('## Output Format');
    blocks.push('Return Markdown with exactly these sections:');
    blocks.push('## Task Understanding');
    blocks.push('## Context Observed');
    blocks.push('## Execution Plan');
    blocks.push('## Risks or Blockers');
    blocks.push('## Completion Criteria');

    if (instructions) {
      blocks.push('## Project Instructions');
      blocks.push(instructions);
    }

    return blocks.join('\n\n');
  }

  static buildSystem(instructions: string | null): string {
    const blocks: string[] = [];

    blocks.push('## Role');
    blocks.push(
      'You are an expert software agent working inside a Node.js monorepo.',
    );

    blocks.push('## Hard Rules');
    blocks.push('- Do not install new dependencies.');
    blocks.push(
      '- If the task requires a missing package, stop and clearly report which package is needed.',
    );
    blocks.push(
      '- If the task cannot be completed without adding a dependency or another external requirement, mark it as BLOCKED instead of forcing a poor workaround.',
    );
    blocks.push('- Keep changes minimal and relevant to the task.');
    blocks.push('- Do not make unrelated refactors.');
    blocks.push(
      `- Follow repository-specific instructions from \`${ENV.AI_INSTRUCTIONS_FILE}\` when provided.`,
    );
    blocks.push(
      '- Assume build and validation are handled by the system after your response.',
    );

    blocks.push('## Preferred Workflow');
    blocks.push('- First inspect the relevant files.');
    blocks.push('- Read only the minimum context needed.');
    blocks.push(
      '- Then apply the smallest correct change that satisfies the task.',
    );
    blocks.push('- Prefer precise, local edits over broad rewrites.');

    blocks.push('## Tool Policy');
    blocks.push('- Use the available tools to inspect and modify files.');
    blocks.push('- Use `list_files` for discovery.');
    blocks.push('- Use `read_file_range` for focused reads after search.');
    blocks.push(
      '- Use `replace_in_file` and `insert_in_file` for local edits.',
    );
    blocks.push('- Use `create_file` only for new files.');
    blocks.push(
      '- Use `save_file` only as a fallback when a targeted tool is not suitable.',
    );

    blocks.push('## Soft Heuristics');
    blocks.push(
      '- Start from the most relevant file or folder mentioned by the task.',
    );
    blocks.push(
      '- Expand the search scope only if the first target is insufficient.',
    );
    blocks.push(
      '- Avoid touching unrelated files just to improve style or consistency.',
    );
    blocks.push(
      '- Prefer preserving existing patterns unless the task requires a clear change.',
    );

    blocks.push('## Completion Rule');
    blocks.push(
      'When the task is complete, respond with a short summary of what you changed.',
    );
    blocks.push('If the task is blocked, respond using this exact format:');
    blocks.push('BLOCKED');
    blocks.push(
      'TYPE: missing_dependency | missing_requirement | missing_access | unknown',
    );
    blocks.push('PACKAGE: <package-name-or-empty>');
    blocks.push('REASON: <short explanation>');

    if (instructions) {
      blocks.push('## Project Instructions');
      blocks.push(instructions);
    }

    return blocks.join('\n\n');
  }

  static buildTaskExecutionMessages(system: string, user: string) {
    return [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];
  }

  static buildTaskRetryMessages(system: string, user: string) {
    return [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];
  }

  static buildRetryErrorText(stderr: string, stdout: string): string {
    const parts: string[] = [];
    if (stderr?.trim()) {
      parts.push('STDERR:');
      parts.push(stderr.trim());
    }
    if (stdout?.trim()) {
      parts.push('STDOUT:');
      parts.push(stdout.trim());
    }
    return parts.join('\n\n') || 'Build failed with no output.';
  }
}
