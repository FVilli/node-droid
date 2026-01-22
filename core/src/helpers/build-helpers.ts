import { BuildResult } from '../types';

export class BuildHelpers {
  static buildSuccess(start: number, stdout: string): BuildResult {
    return { success: true, exitCode: 0, stdout, stderr: '', durationMs: Date.now() - start };
  }

  static buildFailure(start: number, err: any): BuildResult {
    return {
      success: false,
      exitCode: err?.status || 1,
      stdout: err?.stdout?.toString() || '',
      stderr: err?.stderr?.toString() || '',
      durationMs: Date.now() - start
    };
  }
}
