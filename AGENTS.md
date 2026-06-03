# AGENTS.md

Guidance for AI agents and contributors working in this repository.

## Repository Shape

This is intended as a monorepo, but currently only the `core/` package exists.

- Root: repository-level documentation, Docker Compose, and cross-package docs.
- `core/`: NestJS/TypeScript runtime for the node-droid worker.
- `docs/`: architecture and behavior documentation for the runtime.
- `core/docs/api/`: generated TypeDoc output. Do not edit generated API docs by hand.

## Project Purpose

node-droid is a headless autonomous coding worker for Git repositories. It watches configured workspaces, detects trigger commits, extracts AI tasks, runs an OpenAI-compatible LLM tool loop, validates with builds, writes audit logs, and opens merge requests.

Important system invariants from the architecture docs:

- One container instance processes one repo, one run, and one task at a time.
- The LLM API is OpenAI-compatible.
- Runtime configuration is file/env based.
- Scheduling lives in `core/src/app.service.ts`.
- Run orchestration lives in `core/src/services/run-orchestrator.service.ts`.
- Everything important should be auditable.
- Avoid adding custom NestJS modules unless the architecture is intentionally changed.

## Core Layout

Within `core/src/`:

- `main.ts`, `app.module.ts`, `app.service.ts`, `env.ts`, `types.ts`: application bootstrap, wiring, config, and shared types.
- `services/`: injectable NestJS services for orchestration, Git, task lifecycle, LLM, tools, build validation, logging, audit, and merge requests.
- `helpers/`: pure or mostly pure helper classes/functions used by services.
- `libs/`: shared utilities.

When changing behavior, prefer the existing service/helper boundary. Keep orchestration in services and deterministic logic in helpers where that pattern already exists.

## Development Commands

Run package commands from `core/` unless noted otherwise.

```bash
cd core
npm install
npm run build
npm test
npm run lint
npm run format
npm run docs
```

Useful runtime commands:

```bash
cd core
npm start
npm run start:dev
npm run start:prod
```

Root-level Docker Compose is available for containerized runs:

```bash
docker compose up --build
```

## Validation Expectations

Before finishing code changes in `core/`, run the narrowest useful checks:

- `npm run build` for TypeScript/NestJS compilation.
- `npm test` when touching logic with existing or new tests.
- `npm run lint` when changing TypeScript style or imports.

There are currently no root-level package scripts; do not run `npm` commands from the repository root unless root tooling is added later.

## Code Style

- TypeScript target is ES2023 with `module`/`moduleResolution` set to `nodenext`.
- ESLint uses `typescript-eslint` typed rules plus Prettier.
- `@typescript-eslint/no-explicit-any` is disabled, but still prefer precise types when practical.
- `no-floating-promises` and unsafe argument checks are warnings; do not introduce ignored async work casually.
- Use existing NestJS dependency injection patterns and provider registration in `core/src/app.module.ts`.
- Keep comments short and operational; prefer clear names and small helpers.

## Configuration Notes

Runtime environment is centralized in `core/src/env.ts`. Key defaults include:

- `WORKSPACE_FOLDER`: `../workspace` locally, `/app/workspace` in Docker.
- `LLM_API_URL`: OpenAI-compatible API base URL.
- `LLM_MODEL`, `LLM_TEMPERATURE`, `LLM_MAX_TOKENS`: model profile defaults.
- `AI_COMMIT_TAG`: default trigger tag `[ai]`.
- `AI_INSTRUCTIONS_FILE`, `AI_TODO_FILE`: task/instruction file names. `AI_INSTRUCTIONS_FILE` defaults to `AGENTS.md`; `AI_TODO_COMMENT` defaults to `[ai]`.
- `MQTT_AUDIT_*`: audit stream configuration.

Repo-specific runtime configuration is provided through workspace `repo.yml` files, as documented in `README.md`.

## Build Instruction Semantics

node-droid validates target repositories through `.ai/build-instructions.yml` inside the monitored repo, not by guessing project structure.

Keep this behavior deterministic:

- Do not infer build units from folders.
- Treat `.ai/build-instructions.yml` as the source of truth.
- Preserve explicit unit paths, dependencies, install commands, and build commands.
- Fail clearly on missing dependencies, graph cycles, or invalid build configuration.

## Generated and Local Files

- Do not edit `core/docs/api/` manually; regenerate it with `npm run docs`.
- Do not commit local workspace clones or runtime workspaces.
- Activity logs for monitored repositories are written under `.ai/` in those repositories, not necessarily in this source repo.
- Be careful with `core/Dockerfile`: it may contain local user edits. Check `git status` before changing it.

## Documentation Map

Start with these docs when modifying related behavior:

- `docs/01-services-architecture.md`: service responsibilities and invariants.
- `docs/03-workspace-and-repo-services.md`: workspace/repo loading.
- `docs/04-git-service.md`: Git behavior.
- `docs/05-task-lifecycle-services.md`: task extraction and queueing.
- `docs/06-task-execution-and-tools.md`: task execution and tools.
- `docs/07-llm-layer.md`: LLM abstraction.
- `docs/08-build-and-validation.md`: build validation.
- `docs/09-logging-and-audit.md`: logs and MQTT audit events.
- `docs/10-merge-request.md`: merge request creation.
- `docs/11-run-flow.md`: end-to-end run lifecycle.

Keep docs and implementation aligned when changing public behavior.
