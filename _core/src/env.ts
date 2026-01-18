import * as dotenv from 'dotenv';
import { version, name } from '../package.json'
import * as path from 'path';
dotenv.config();

const revision = 1;

export abstract class ENV {

    static readonly VERSION = version + "." + revision;
    static readonly APPNAME = name;
    static readonly FOLDER_STORAGE = process.env.FOLDER_STORAGE || process.cwd() === '/app' ? '/app/workspace' : path.join(process.cwd(), './workspace');
    static readonly WATCH_INTERVAL = parseInt(process.env.WATCH_INTERVAL || '30000');

    // static readonly WATCH_BRANCH = process.env.WATCH_BRANCH || 'main'; 
    
    // static readonly LLM_API_URL = process.env.LLM_API_URL || 'http://localhost:8000/v1'; 
    // static readonly LLM_API_KEY = process.env.LLM_API_KEY || 'dummy';
    // static readonly LLM_MODEL = process.env.LLM_MODEL || 'llama-3-70b';
    // static readonly REPOMIX_MAX_CONTEXT_SIZE = parseInt(process.env.REPOMIX_MAX_CONTEXT_SIZE || '30000');
    // static readonly BUILD_TIMEOUT_SECONDS = parseInt(process.env.BUILD_TIMEOUT_SECONDS || '300');
    // static readonly TEST_TIMEOUT_SECONDS = parseInt(process.env.TEST_TIMEOUT_SECONDS || '300');
}

console.log(ENV);