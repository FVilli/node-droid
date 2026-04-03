import { Injectable } from '@nestjs/common';
import { RunContext, RunPhase, RunSnapshot, RunStatus, TaskOutcome } from '../types';

@Injectable()
export class RunStateService {
  private snapshot: RunSnapshot = {
    phase: 'IDLE',
    status: 'STOPPED',
    shuttingDown: false,
    attempt: 0,
  };

  reset() {
    const shuttingDown = this.snapshot.shuttingDown;
    this.snapshot = {
      phase: 'IDLE',
      status: 'STOPPED',
      shuttingDown,
      attempt: 0,
    };
  }

  startRun(ctx: RunContext) {
    this.snapshot.context = ctx;
    this.snapshot.status = 'RUNNING';
    this.snapshot.phase = 'BOOTSTRAP';
    this.snapshot.currentTask = undefined;
    this.snapshot.attempt = 0;
  }

  setPhase(phase: RunPhase) { this.snapshot.phase = phase; }
  setStatus(status: RunStatus) { this.snapshot.status = status; }
  setContext(ctx: RunContext) { this.snapshot.context = ctx; }

  setCurrentTask(task?: { id?: string; title: string; index?: number; status?: TaskOutcome }) {
    this.snapshot.currentTask = task;
    this.snapshot.attempt = 0;
  }

  setCurrentTaskStatus(status: TaskOutcome) {
    if (!this.snapshot.currentTask) return;
    this.snapshot.currentTask = { ...this.snapshot.currentTask, status };
  }

  clearCurrentTask() {
    this.snapshot.currentTask = undefined;
    this.snapshot.attempt = 0;
  }

  resetAttempt() { this.snapshot.attempt = 0; }
  incAttempt() { this.snapshot.attempt++; }

  getPhase() { return this.snapshot.phase; }
  getStatus() { return this.snapshot.status; }
  getContext() { return this.snapshot.context; }
  getCurrentTask() { return this.snapshot.currentTask; }
  getAttempt() { return this.snapshot.attempt; }
  getSnapshot(): RunSnapshot { return { ...this.snapshot, currentTask: this.snapshot.currentTask ? { ...this.snapshot.currentTask } : undefined, context: this.snapshot.context ? { ...this.snapshot.context, triggerCommit: this.snapshot.context.triggerCommit ? { ...this.snapshot.context.triggerCommit } : undefined } : undefined }; }

  setShuttingDown(v: boolean) { this.snapshot.shuttingDown = v; }
  isShuttingDown() { return this.snapshot.shuttingDown; }
}
