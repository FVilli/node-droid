import { Injectable } from '@nestjs/common';
import * as path from 'path';
import { ENV } from '../env';
import { RepoDescriptor } from '../types';
import { WorkspaceLoader } from '../helpers/workspace-loader';

@Injectable()
export class WorkspaceService {

  listRepos(): RepoDescriptor[] {
    return WorkspaceLoader.listRepos(ENV.WORKSPACE_FOLDER);
  }

  loadRepo(id: string): RepoDescriptor | null {
    const root = path.join(ENV.WORKSPACE_FOLDER, id);
    return WorkspaceLoader.loadRepo(root, id);
  }
}
