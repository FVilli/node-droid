import * as dotenv from 'dotenv';
import { version, name } from '../package.json';
import * as path from 'path';

dotenv.config();
const revision = 7;

export abstract class ENV {
  static readonly VERSION = `${version}.${revision}`;
  static readonly APPNAME = name;
  static readonly WORKSPACE_FOLDER = process.env.WORKSPACE_FOLDER || (process.cwd() === '/app' ? '/app/workspace' : path.join(process.cwd(), '../workspace'));
  static readonly LLM_API_URL = process.env.LLM_API_URL || 'http://localhost:8000/v1';
  static readonly LLM_API_KEY = process.env.LLM_API_KEY || 'dummy';
  static readonly LLM_MODEL = process.env.LLM_MODEL || 'qwen/qwen3-coder-next'; // qwen/qwen3-coder-30b // openai/gpt-oss-120b // openai/gpt-oss-20b
  static readonly LLM_TEMPERATURE = parseFloat(process.env.LLM_TEMPERATURE || '0.2');
  static readonly LLM_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '262144', 10);
  static readonly INSTALL_COMMAND = process.env.INSTALL_COMMAND || 'npm i';
  static readonly BUILD_COMMAND = process.env.BUILD_COMMAND || 'npm run build';
  static readonly BUILD_TIMEOUT_SECONDS = parseInt(process.env.BUILD_TIMEOUT_SECONDS || '300', 10);
  static readonly MAX_TASK_RETRIES = parseInt(process.env.MAX_TASK_RETRIES || '3', 10);
  static readonly MAX_TOOL_CALLS_PER_TASK = parseInt(process.env.MAX_TOOL_CALLS_PER_TASK || '30', 10);
  static readonly STOP_POLICY = process.env.STOP_POLICY || 'STOP_ON_FIRST_FAILURE';
  // --- AI / Triggering ---
  static readonly AI_COMMIT_TAG = process.env.AI_COMMIT_TAG || '[ai]';
  static readonly AI_TODO_FILE = process.env.AI_TODO_FILE || 'ai.md';
  static readonly AI_TODO_COMMENT = process.env.AI_TODO_COMMENT || 'ai:';
  static readonly AI_BRANCH_PREFIX = process.env.AI_BRANCH_PREFIX || 'ai';
  // --- DRY RUN semantics (locale reale / remoto dry) ---
  static readonly DRY_RUN = process.env.DRY_RUN === 'true';
  static readonly NO_REMOTE_SIDE_EFFECTS = ENV.DRY_RUN; // skip push, MR
  static readonly NO_LLM = ENV.DRY_RUN;                 // skip LLM
  // --- NODE ---
  static readonly BUILD_CMD = process.env.BUILD_CMD || 'npm run build';
  static readonly INSTALL_CMD = process.env.INSTALL_CMD || 'npm i';
  static readonly REPO_CODE_FOLDER = process.env.REPO_CODE_FOLDER || 'code';
  static readonly REPO_SSH_FOLDER = process.env.REPO_SSH_FOLDER || '.ssh';
  static readonly REPO_AI_FOLDER = process.env.REPO_AI_FOLDER || '.ai';
  static readonly LOG_LEVEL = process.env.LOG_LEVEL || 'info';
}
