# node-droid — Architettura dei Servizi

Questo documento descrive l’architettura dei servizi interni di **node-droid**.

## Invarianti di sistema

- 1 istanza = 1 container
- Mai parallelismo
- 1 repo alla volta
- 1 run alla volta
- 1 task alla volta
- Protocollo LLM: OpenAI-compatible
- Configurazione file-based (workspace)
- Nessun modulo NestJS custom
- Orchestrazione in `app.service.ts`
- Tutto deve essere auditabile

---

## Struttura del codice

```
src/

  main.ts
  app.module.ts
  app.service.ts
  env.ts
  interfaces.ts
  types.ts

  services/
    *.service.ts

  libs/
    *.ts
```


---

## Classificazione dei servizi

I servizi sono suddivisi in:

1. Orchestrazione e stato
2. Workspace e repo
3. Git e VCS
4. Task lifecycle
5. Esecuzione task
6. Tool emulation
7. LLM abstraction
8. Build & validation
9. Logging & audit
10. Merge Request
11. Analisi semantica (facoltativi)

---

## Elenco dei servizi

### Orchestrazione e stato
- `app.service.ts`
- `run-state.service.ts`

### Workspace e repo
- `workspace.service.ts`
- `repo-context.service.ts`

### Git
- `git.service.ts`

### Task lifecycle
- `task-extraction.service.ts`
- `task-normalization.service.ts`
- `task-queue.service.ts`

### Esecuzione task
- `task-executor.service.ts`

### Tool emulation
- `tool-registry.service.ts`
- `filesystem-tool.service.ts`

### LLM abstraction
- `llm-client.service.ts`
- `llm-profile-resolver.service.ts`
- `prompt-template.service.ts`

### Build & validation
- `build.service.ts`

### Logging & audit
- `run-logger.service.ts`
- `artifact.service.ts` (opzionale)

### Merge Request
- `merge-request.service.ts`

### Analisi semantica (non critici)
- `commit-analysis.service.ts`
- `diff-summary.service.ts`
- `run-summary.service.ts`
