import { Injectable } from '@nestjs/common';
import { RepoContextService } from './repo-context.service';
import { Task } from '../types';
import { AIInstructionsHelper } from '../helpers/ai-instructions';

@Injectable()
export class AIInstructionsService {
  constructor(private readonly repoContext: RepoContextService) {}

  getInstructions(task: Task): string | null {
    return AIInstructionsHelper.getInstructions(this.repoContext.get().codePath, task);
  }
}
