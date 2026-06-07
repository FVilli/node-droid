# node-droid - Configuration

Questo documento raccoglie le configurazioni runtime di node-droid.

---

## Environment

La configurazione globale e' centralizzata in `core/src/env.ts`.

### Workspace

- `WORKSPACE_FOLDER`: cartella che contiene i repo monitorati.
  - default locale: `../workspace`
  - default Docker quando `cwd` e' `/app`: `/app/workspace`
- `REPO_CODE_FOLDER`: cartella del clone dentro ogni repo descriptor, default `code`.
- `REPO_SSH_FOLDER`: cartella SSH del repo descriptor, default `.ssh`.
- `REPO_AI_FOLDER`: cartella log nel clone, default `.ai`.

Layout atteso:

```text
workspace/
  repo-id/
    repo.yml
    code/
      .git/
      .ai/
```

### LLM

- `LLM_API_URL`: endpoint OpenAI-compatible.
- `LLM_API_KEY`: API key.
- `LLM_MODEL`: modello.
- `LLM_TEMPERATURE`: temperatura.
- `LLM_MAX_TOKENS`: max token.

Gli override per repo sono risolti tramite `repo.yml`.

### Agent

- `MAX_TASK_RETRIES`: retry massimi per task.
- `MAX_TOOL_CALLS_PER_TASK`: limite chiamate tool per task.
- `STOP_POLICY`: policy configurata, attualmente non guida ancora un ramo complesso di orchestrazione.

### Trigger e file AI

- `AI_COMMIT_TAG`: tag commit che attiva la run, default `[ai]`.
- `AI_TODO_COMMENT`: marker commento task, default `[ai]`.
- `AI_TODO_FILE`: file task markdown, default `ai-tasks.md`.
- `AI_INSTRUCTIONS_FILE`: file istruzioni, default `AGENTS.md`.
- `AI_BRANCH_PREFIX`: prefisso branch di run, default `ai`.

### Build

- `BUILD_TIMEOUT_SECONDS`: configurato, ma la build corrente usa `execSync` senza timeout esplicito.
- Il gate cerca `scripts.build` nei `package.json` rilevanti ed esegue `npm run build`.
- Se `package.json` e' stato toccato e lo stesso package ha `scripts.build`, esegue `scripts.install` con `npm run install` o altrimenti `npm i`.
- Se lo script `build` non esiste, il gate viene saltato e lo skip viene loggato.

### Dry Run

- `DRY_RUN=true` abilita modalita' dry.
- In dry run:
  - `NO_REMOTE_SIDE_EFFECTS` evita push e PR.
  - `NO_LLM` evita chiamate LLM.

### MQTT Audit

- `MQTT_AUDIT_ENABLED`
- `MQTT_AUDIT_URL`
- `MQTT_AUDIT_USERNAME`
- `MQTT_AUDIT_PASSWORD`
- `MQTT_AUDIT_CLIENT_ID`
- `MQTT_AUDIT_TOPIC_PREFIX`
- `MQTT_AUDIT_QOS`
- `MQTT_AUDIT_RETAIN`

Il contratto eventi e' descritto in `docs/09-logging-and-audit.md`.

---

## repo.yml

Ogni repo monitorato deve avere un `repo.yml` nella propria cartella workspace.

Campi principali:

```yaml
remote: git@github.com:org/repo.git
baseBranch: main

llm:
  baseUrl: http://localhost:8000/v1
  apiKey: dummy
  model: qwen/qwen3-coder-next
  temperature: 0.2
  maxTokens: 262144

agent:
  maxTaskRetries: 3
  stopOnFailure: false
  maxToolCallsPerTask: 30

triggers:
  commitPrefix: "[ai]"

token: ghp_xxx
```

Stato attuale:

- `remote` e `baseBranch` sono obbligatori per il flusso Git.
- `llm` viene passato al contesto e risolto con i default ENV.
- `agent.maxTaskRetries` e `agent.maxToolCallsPerTask` sono usati dal task executor.
- `agent.stopOnFailure` e `triggers.commitPrefix` sono presenti nel tipo, ma il codice usa ancora `ENV.AI_COMMIT_TAG`.
- `token` viene passato alla creazione PR.
- La build non e' configurabile da `repo.yml`: usa lo script standard `build` dei package rilevanti.

Quando si aggiunge un nuovo campo in `repo.yml`, aggiornare insieme:

- `core/src/types.ts`
- `core/src/helpers/repo-context-builder.ts`
- questo documento
