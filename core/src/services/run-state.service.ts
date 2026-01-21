import { Injectable } from '@nestjs/common';
import { RunPhase, RunStatus } from '../types';
import { RunContext } from '../interfaces';

@Injectable()
export class RunStateService {
  private phase: RunPhase = 'IDLE';
  private status: RunStatus = 'STOPPED';
  private context?: RunContext;
  private currentTaskId?: string;
  private attempt = 0;
  private shuttingDown = false;

  reset() { this.phase = 'IDLE'; this.status = 'STOPPED'; this.context = undefined; this.currentTaskId = undefined; this.attempt = 0; }

  setPhase(phase: RunPhase) { this.phase = phase; }
  setStatus(status: RunStatus) { this.status = status; }
  setContext(ctx: RunContext) { this.context = ctx; }
  setCurrentTask(taskId?: string) { this.currentTaskId = taskId; this.attempt = 0; }
  resetAttempt() { this.attempt = 0; }
  incAttempt() { this.attempt++; }

  getPhase() { return this.phase; }
  getStatus() { return this.status; }
  getContext() { return this.context; }
  getCurrentTask() { return this.currentTaskId; }
  getAttempt() { return this.attempt; }

  setShuttingDown(v: boolean) { this.shuttingDown = v; }
  isShuttingDown() { return this.shuttingDown; }
}
