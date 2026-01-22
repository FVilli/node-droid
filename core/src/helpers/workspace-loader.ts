import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import { RepoDefinition, RepoDescriptor } from '../types';

export class WorkspaceLoader {
  static listRepos(workspaceFolder: string): RepoDescriptor[] {
    if (!fs.existsSync(workspaceFolder)) return [];
    return fs.readdirSync(workspaceFolder)
      .map(id => this.loadRepo(path.join(workspaceFolder, id), id))
      .filter(Boolean) as RepoDescriptor[];
  }

  static loadRepo(root: string, id: string): RepoDescriptor | null {
    const configPath = path.join(root, 'repo.yml');
    if (!fs.existsSync(root) || !fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = parse(raw) as RepoDefinition;
    return { id, path: root, config };
  }
}
