# 🤖 node-droid

**Your Autonomous AI Code Assistant for Node.js Monorepos**

node-droid is an autonomous development agent that watches your Git repositories, extracts tasks from code and markdown, executes them with an LLM + tools, validates with a build, and opens a PR with a full audit log.

## ✨ Features

- 🔍 **Commit-Based Triggering** - Watches for `[ai]` commits and starts a run
- 🧠 **Task Extraction** - Parses tasks only from files in the trigger commit
- 🤖 **LLM Execution Loop** - Runs tasks with tool calls and retries
- ✅ **Build Gate** - Runs build after task execution, with fix retries on failure
- 📊 **Exhaustive Run Logs** - Detailed Markdown reports in `.ai/` with full task context
- 🧠 **Project Context Awareness** - Repomix-backed context for better prompts
- 📌 **AI Instructions** - `ai-instructions.md` directives at root and folder-level
- 🧹 **Task Marker Cleanup** - Removes `ai.md` and task comments after processing
- 🧾 **Always Creates PR** - Opens a PR even if tasks fail (developer decides)

## 🧠 How It works (logic)

Each run follows a strict, non-interactive workflow:
1. Sync the target branch from the remote and look for trigger commits that include `[ai]`.
2. Scope task extraction only to files changed in those commits (for speed and precision).
3. If tasks are found, create a dedicated run branch and execute them in order.
4. A task is considered successful only if the build passes after its changes.
5. The run always opens a pull request, even if one or more tasks fail.

node-droid is intentionally headless: it is a background worker meant for small, well-defined tasks communicated via Git. All activity is documented in the `.ai/` folder at the repository root, including summaries, task status, and execution context.

## 🧠 How It works (code)

node-droid orchestrates a full run by combining dedicated services: 
- `WorkspaceService` and `RepoContextService` load repo configuration and paths
- `GitService` keeps the local clone aligned to the remote
- `TaskExtractionService` parses tasks from committed files
- `TranslateToEnglishService` normalizes task titles/descriptions
- `PromptTemplateService`, `PromptService`, `AIInstructionsService`, and `RepomixService` build the final prompt context
- `LLMProfileResolverService` and `LLMClientService` drive the model calls
- `ToolRegistryService` executes tool invocations
- `ScriptsService` runs builds
- `RunStateService` coordinates lifecycle state
- `RunLoggerService` produces the Markdown audit logs and summaries

## 🚀 Quick Start (Self-Hosted)

This is the easy way to run node-droid.

If you want to run node-droid without cloning this repo, you can use a Docker image and a local `docker-compose.yml`.
Create a folder with a `workspace/` and a `docker-compose.yml`, then start the container.

Example `docker-compose.yml` (update `image:` to your published image name):
```yaml
services:
  node-droid:
    image: node-droid:latest
    container_name: node-droid
    restart: unless-stopped
    volumes:
      - ./workspace:/app/workspace
      - ~/.ssh:/root/.ssh:ro
    environment:
      LLM_API_URL: "http://host.docker.internal:8000/v1"
      LLM_API_KEY: "dummy"
      LLM_MODEL: "gpt-4o-mini"
```

Then:
```bash
docker-compose up -d
```

Populate `./workspace/<repo-id>/repo.yml` as described below and node-droid will start monitoring.

### Workspace Volume + repo.yml

node-droid scans `WORKSPACE_FOLDER` (default: `/app/workspace` in Docker).  
Each repo you want to monitor must live in its own folder with a `repo.yml` file.  
The repo will be cloned into a `code/` subfolder under that repo directory.

Example layout:
```
/app/workspace/
└── mqtt-archiver/
    ├── repo.yml
    └── code/            # git clone happens here
```

Example `docker-compose.yml` volume mapping:
```yaml
services:
  node-droid:
    volumes:
      - ./workspace:/app/workspace
```

Example `repo.yml` (comments are supported):
```yaml
# REQUIRED: git remote to clone
remote: git@github.com:org/repo.git
# REQUIRED: base branch to monitor
baseBranch: main

# OPTIONAL: overrides ENV.BUILD_COMMAND / BUILD_CMD
buildCommand: npm run build

# OPTIONAL: GitHub token for PR creation (can also use GH_TOKEN env)
token: ghp_xxx

# OPTIONAL: overrides LLM_* env values when provided
llm:
  baseUrl: http://localhost:8000/v1
  apiKey: dummy
  model: gpt-4o-mini
  temperature: 0.2
  maxTokens: 4096

# OPTIONAL: overrides agent policy env values
agent:
  maxTaskRetries: 3        # overrides MAX_TASK_RETRIES
  stopOnFailure: false     # reserved for future behavior
  maxToolCallsPerTask: 30  # overrides MAX_TOOL_CALLS_PER_TASK

# OPTIONAL: Repomix settings (only used if repomix is installed in the repo)
repomix:
  enabled: true
  maxContextSize: 30000
  style: markdown
  include:
    - "**/*.ts"
    - "**/*.js"
    - "**/*.json"
    - "**/*.md"
  ignore:
    useGitignore: true
    useDefaultPatterns: true
    customPatterns:
      - "node_modules/**"
      - "dist/**"
  removeComments: false
  removeEmptyLines: true
  showLineNumbers: false

# OPTIONAL: overrides AI_COMMIT_TAG if provided
triggers:
  commitPrefix: "[ai]"
```

Note: PR creation currently uses the GitHub CLI (`gh`), so only GitHub remotes are supported.

## 🛠️ How to Develop & Contribute

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (optional, for containerized testing)
- An LLM API endpoint (vLLM, Ollama, or OpenAI-compatible)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/node-droid.git
cd node-droid
```

2. Install dependencies:
```bash
cd core
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

4. Build:
```bash
npm run build
```

5. Run:
```bash
npm start
```

## 📖 Usage

### 1. Add Task Comments
Add comments where the change is needed. Use `ai:` for the task title, then add optional description lines with `//`.
```typescript
// apps/backend/src/users/users.service.ts

export class UsersService {
  // ai: Add method for soft delete of users
  // Keep backwards compatibility with existing callers
  findAll() {
    return this.userRepository.find();
  }
}
```
The first code line immediately after the task comment is included as context for the task request.

### 2. Add ai.md (Optional, for task lists)
Place `ai.md` in `src/` or any nested folder to define a list of tasks.  
Each task is a bullet, and you can add a description with a multiline indented block.
```markdown
## AI Tasks

- Create authentication service in `apps/backend/src/auth`
- Implement JWT token generation
  Add refresh token flow and expiry handling
- Add login and register endpoints | Return 401 on invalid credentials
- Create auth guards for protected routes
```

### 3. Add ai-instructions.md (Optional, directives)
You can add an `ai-instructions.md` in the repo root and/or in any subfolder.  
Root instructions are included for every task. Folder instructions are included only for tasks in that folder.
```markdown
## Project Rules
- Use pnpm, not npm
- Prefer zod for schema validation
- Keep changes minimal and focused
```

### 4. Commit with AI Tag
Only files involved in the commit are scanned for tasks.
The tag is only a trigger and is removed from run/summary titles.
```bash
git commit -m "[ai] Add user authentication feature"
```

### 5. Push and Watch
```bash
git push origin develop
```

node-droid will:
1. Detect the `[ai]` commit
2. Extract tasks only from files included in the commit (comments and ai.md)
3. Execute each task (it can read/modify any file in the repo while working)
4. Build after each task (with fix retries if build fails)
5. Update task markers in code comments and remove `ai.md`
6. Create a merge request (even if some tasks fail)

Note: comment-based task markers are replaced with ✅/❌ status lines, while `ai.md` files are removed after processing; the complete task definition and outputs are preserved in the run report under `.ai/`.

## 📁 Activity Logs

All activities are logged in `.ai/`:
```
.ai/
├── 2026-01-17 14.30_281740.md
├── 2026-01-17 15.22_281741.md
```

Each log contains:
- Run summary (timings, attempts, LLM/tool counts, files touched)
- Task-by-task timeline with prompts, tool calls, and build output
- Full task definitions and statuses

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WORKSPACE_FOLDER` | Workspace root | `../workspace` |
| `WATCH_INTERVAL` | Poll interval (ms) | `60000` |
| `LLM_API_URL` | LLM API endpoint | `http://localhost:8000/v1` |
| `LLM_API_KEY` | LLM API key | `dummy` |
| `LLM_MODEL` | Model to use | `gpt-4o-mini` |
| `LLM_TEMPERATURE` | Model temperature | `0.2` |
| `LLM_MAX_TOKENS` | Max tokens | `4096` |
| `BUILD_CMD` | Build command | `npm run build` |
| `MAX_TASK_RETRIES` | Task retries | `3` |
| `MAX_TOOL_CALLS_PER_TASK` | Tool call limit | `30` |
| `AI_COMMIT_TAG` | Commit trigger tag | `[ai]` |
| `AI_TODO_FILE` | Task file name | `ai.md` |
| `AI_TODO_COMMENT` | Task comment tag | `ai:` |
| `AI_BRANCH_PREFIX` | Branch prefix | `ai` |
| `DRY_RUN` | Disable LLM + remote side effects | `false` |
| `GH_TOKEN` | GitHub token for PR creation | unset |

### Repomix Integration

Repomix is configured per repo via `repo.yml` and used only when `repomix.enabled: true`.  
If enabled but the package is missing in the target repository, node-droid logs a warning and continues without it.

Add to the target repository `package.json`:
```json
{
  "devDependencies": {
    "repomix": "^0.1.0"
  }
}
```

node-droid will automatically use Repomix if available to provide enhanced project context to the LLM.

## 🏗️ Architecture
```
node-droid/
├── Workspace Scanner  # Discovers repos
├── Task Extraction    # Reads ai.md and ai: comments
├── Task Executor      # LLM loop + tools + build retries
├── Run Logger         # Full Markdown report in .ai/
└── Repomix Service    # Project context generation
```

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## ⚠️ Disclaimer

node-droid is an experimental tool. Always review AI-generated code before merging to production.

---

**Built with ❤️ for the Node.js community**
