# 🤖 node-droid

**Your Autonomous AI Code Assistant for Node.js Monorepos**

node-droid is an intelligent development automation tool that watches your Git repository and automatically implements code changes based on commit messages and task descriptions.

## ✨ Features

- 🔍 **Automatic Commit Monitoring** - Watches your repository for `[AI]` commits
- 🤖 **Autonomous Code Generation** - Uses LLM to implement tasks
- 📦 **Monorepo Support** - Handles multiple packages with individual build/test cycles
- ✅ **Automatic Validation** - Builds and tests changes before committing
- 📊 **Detailed Activity Logs** - Comprehensive telemetry in `.ai-activity/`
- 🧠 **Project Context Awareness** - Optional Repomix integration for enhanced understanding
- 🔄 **Iterative Refinement** - Automatically retries and refines implementations

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for containerized deployment)
- An LLM API endpoint (vLLM, Ollama, or OpenAI-compatible)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/node-droid.git
cd node-droid
```

2. Install dependencies:
```bash
cd packages/core
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

### Docker Deployment
```bash
cd docker
docker-compose up -d
```

## 📖 Usage

### 1. Commit with AI Tag
```bash
git commit -m "[AI] Add user authentication feature"
```

### 2. Add Tasks in Markdown

Create a file like `docs/tasks.md`:
```markdown
## AI Tasks

- [ ] Create authentication service in `apps/backend/src/auth`
- [ ] Implement JWT token generation
- [ ] Add login and register endpoints
- [ ] Create auth guards for protected routes
```

### 3. Or Use Code Comments
```typescript
// apps/backend/src/users/users.service.ts

export class UsersService {
  // AI: Add method for soft delete of users
  
  // AI: Implement pagination for findAll()
  findAll() {
    return this.userRepository.find();
  }
}
```

### 4. Push and Watch
```bash
git push origin develop
```

node-droid will:
1. Detect the `[AI]` commit
2. Create a new branch
3. Execute each task
4. Build and test after each change
5. Create a merge request

## 📁 Activity Logs

All activities are logged in `.ai-activity/`:
```
.ai-activity/
├── 2026-01-17 14.30.45 - a3f2b1c - Add-authentication.md
├── 2026-01-17 15.22.10 - b4e3a2d - Refactor-user-service.md
└── repomix-output.txt
```

Each log contains:
- Execution metadata
- Task-by-task breakdown
- File changes and line counts
- Build/test results
- LLM and tool call statistics

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REPO_PATH` | Path to the repository | `/workspace/repo` |
| `WATCH_BRANCH` | Branch to monitor | `main` |
| `POLL_INTERVAL` | Check interval (ms) | `30000` |
| `LLM_API_URL` | LLM API endpoint | `http://localhost:8000/v1` |
| `LLM_MODEL` | Model to use | `llama-3-70b` |
| `REPOMIX_MAX_CONTEXT_SIZE` | Max context size | `30000` |

### Repomix Integration

Add to your project's `package.json`:
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
├── Git Watcher        # Monitors repository for [AI] commits
├── Commit Processor   # Extracts and orchestrates tasks
├── AI Agent           # Executes tasks using LLM + MCP tools
├── Monorepo Manager   # Handles npm install, build, test
├── Activity Logger    # Detailed telemetry and logging
└── Repomix Service    # Project context generation
```

## 🛠️ Development
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run tests (if applicable)
npm test
```

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## ⚠️ Disclaimer

node-droid is an experimental tool. Always review AI-generated code before merging to production.

---

**Built with ❤️ for the Node.js community**