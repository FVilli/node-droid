export class GitCommands {
  static checkout(branch: string): string { return `git checkout ${branch}`; }
  static fetch(): string { return 'git fetch origin'; }
  static createBranch(branch: string): string { return `git checkout -b ${branch}`; }
  static commit(msg: string): string { return `git add -A && git commit -m "${msg}"`; }
  static pull(branch: string): string {
    return [
      'git fetch --all',
      `git checkout ${branch}`,
      `git reset --hard origin/${branch}`
    ].join(' && ');
  }
  static push(branch: string): string { return `git push origin ${branch}`; }
  static clone(remote: string): string { return `git clone ${remote} code`; }

  static createPr(baseBranch: string, branch: string, title: string, body: string, token?: string, bodyFile?: string): string {
    const ghToken = token || process.env.GH_TOKEN;
    const safeTitle = this.escapeDoubleQuotes(title);
    const bodyArg = bodyFile
      ? `--body-file "${this.escapeDoubleQuotes(bodyFile)}"`
      : `--body "${this.escapeDoubleQuotes(body)}"`;
    let cmd = `gh pr create --title "${safeTitle}" ${bodyArg} --base ${baseBranch} --head ${branch}`;
    if (ghToken) cmd = `export GH_TOKEN="${ghToken}" && ` + cmd;
    return cmd;
  }

  private static escapeDoubleQuotes(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}
