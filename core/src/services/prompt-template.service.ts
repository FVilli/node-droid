import { Injectable } from '@nestjs/common';
import { PromptTemplates } from '../helpers/prompt-templates';

@Injectable()
export class PromptTemplateService {

  render(name: string, params: any): string {
    return PromptTemplates.render(name, params);
  }
}
