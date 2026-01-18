import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { RepoContextService } from './repo-context.service';
import { Task } from '../interfaces';
import { ENV } from '../env';

@Injectable()
export class RunLoggerService {
  private filePath?: string;

  constructor(private readonly repoContext: RepoContextService) {}

  init(runId: string, repoId?: string) {
    const { aiPath } = this.repoContext.get();
    fs.mkdirSync(aiPath, { recursive: true });
    this.filePath = path.join(aiPath, `run-${runId}.md`);
    fs.writeFileSync(this.filePath, `# Run ${runId}\n\n${repoId ? `Repo: ${repoId}\n\n` : ''}---\n\n`);
    if (ENV.DRY_RUN) this.section('DRY RUN MODE');
  }


  private write(md: string) { if (this.filePath) fs.appendFileSync(this.filePath, md + '\n'); }

  section(title: string) { this.write(`\n## ${title}\n`); }

  info(msg: string) { this.write(`- ℹ️ ${msg}`); }
  warn(msg: string) { this.write(`- ⚠️ ${msg}`); }
  error(msg: string) { this.write(`- ❌ ${msg}`); }
  dry(msg: string) { this.write(`- 🧪 [DRY] ${msg}`); }


  // ---- Task events ----

  taskStart(task: Task) { this.section(`Task ${task.id}`); this.info(task.title); }
  taskAttempt(id: string, n: number) { this.info(`Attempt ${n} for ${id}`); }
  taskDone(id: string) { this.info(`Done: ${id}`); }
  taskFailed(id: string) { this.error(`Failed: ${id}`); }

  taskBuildFailed(id: string, err: any) {
    this.warn(`Build failed for ${id}`);
    this.write('```');
    this.write(err.stderr || 'No stderr');
    this.write('```');
  }

  // ---- Run lifecycle ----

  runInterrupted(reason = 'Shutdown requested') {
    this.section('Run interrupted');
    this.warn(reason);
  }

  runCompleted() {
    this.section('Run completed');
    this.info('All tasks processed');
  }

  runFailed(reason?: string) {
    this.section('Run failed');
    if (reason) this.error(reason);
  }
}
