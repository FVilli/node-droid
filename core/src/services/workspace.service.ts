import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ENV } from '../env';
import { RepoDescriptor, RepoDefinition } from '../interfaces';

@Injectable()
export class WorkspaceService {

  listRepos(): RepoDescriptor[] {
    if (!fs.existsSync(ENV.FOLDER_STORAGE)) return [];
    return fs.readdirSync(ENV.FOLDER_STORAGE).map(id => this.loadRepo(id)).filter(Boolean) as RepoDescriptor[];
  }

  loadRepo(id: string): RepoDescriptor | null {
    const root = path.join(ENV.FOLDER_STORAGE, id);
    const configPath = path.join(root, 'repo.json');
    if (!fs.existsSync(root) || !fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as RepoDefinition;
    return { id, path: root, config };
  }
}
