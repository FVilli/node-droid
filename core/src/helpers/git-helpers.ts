import { extractTag, normalizeCommits, normalizeGitFiles, splitPipe } from '../libs/utils';
import { GitRemoteUpdates } from '../types';

export class GitHelpers {
  static buildRemoteDeltaCommand(baseBranch: string): string {
    return `
      git checkout ${baseBranch} 2>/dev/null && git fetch origin 2>/dev/null && {
        echo "<RESULT>";
        echo "<BRANCH>$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'error')</BRANCH>";
        echo "<COMMITS>$(git log --oneline HEAD..origin/${baseBranch} 2>/dev/null | tr '\\n' '|' | sed 's/|$//')</COMMITS>";
        echo "<FILES>$(git diff --name-status HEAD origin/${baseBranch} 2>/dev/null | tr '\\n' '|' | sed 's/|$//')</FILES>";
        echo "</RESULT>";
      } 2>/dev/null || echo "<RESULT><ERROR>Impossibile completare l'operazione</ERROR></RESULT>"
    `.replace(/\s+/g, ' ').trim();
  }

  static parseRemoteDelta(output: string): GitRemoteUpdates {
    const branch = extractTag(output, 'BRANCH');
    const commits = normalizeCommits(splitPipe(extractTag(output, 'COMMITS')));
    const files = normalizeGitFiles(splitPipe(extractTag(output, 'FILES')));
    const error = extractTag(output, 'ERROR');
    return { branch: branch || '', commits, files, error: error || undefined };
  }
}
