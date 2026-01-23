export type TaskEventLike = { ts: number; kind: string; data?: any };

import { toLocalIso } from '../libs/utils';

export class RunLogFormatters {
  static formatTaskEvent(ev: TaskEventLike): string[] {
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

  static formatTime(d: Date): string {
    const iso = toLocalIso(d);
    return iso.split('T')[1].split('.')[0];
  }

  static formatDateTime(d: Date): string {
    const iso = toLocalIso(d);
    return iso.replace('T', ' ').split('.')[0];
  }

  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    const rem = s - m * 60;
    return `${m}m ${rem.toFixed(1)}s`;
  }

  static escapePipes(s: string): string {
    return s.replace(/\|/g, '\\|');
  }
}
