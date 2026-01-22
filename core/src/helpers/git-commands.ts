export class GitCommands {
  static checkout(branch: string): string { return `git checkout ${branch}`; }
  static fetch(): string { return 'git fetch origin'; }
  static createBranch(branch: string): string { return `git checkout -b ${branch}`; }
  static commit(msg: string): string { return `git add -A && git commit -m "${msg}"`; }
  static pull(branch: string): string { return `git pull origin ${branch}`; }
  static push(branch: string): string { return `git push origin ${branch}`; }
  static clone(remote: string): string { return `git clone ${remote} code`; }

  static createPr(baseBranch: string, branch: string, title: string, body: string, token?: string): string {
    const ghToken = token || process.env.GH_TOKEN;
    let cmd = `gh pr create --title "${title}" --body "${body}" --base ${baseBranch} --head ${branch}`;
    if (ghToken) cmd = `export GH_TOKEN="${ghToken}" && ` + cmd;
    return cmd;
  }
}
