# node-droid - Data Model

Questo documento riassume i tipi principali definiti in `core/src/types.ts`.

---

## RepoDefinition

Configurazione letta da `repo.yml`.

Campi principali:

- `remote`: remote Git.
- `baseBranch`: branch monitorato.
- `llm`: override profilo LLM.
- `agent`: policy task/tool.
- `triggers`: configurazione trigger.
- `token`: token opzionale per PR.

Nota: non tutti i campi dichiarati sono ancora usati in modo completo dal runtime. Verificare `docs/12-configuration.md`.

---

## RepoDescriptor

Repo scoperto nella workspace:

- `id`: nome cartella workspace.
- `path`: path assoluto della cartella descriptor.
- `config`: `RepoDefinition` parsato da YAML.

---

## RepoContext

Contesto risolto del repo attivo:

- `id`
- `rootPath`
- `codePath`
- `aiPath`
- `sshPath`
- `remote`
- `baseBranch`
- `llmProfile`
- `agentPolicy`

`RepoContextService` mantiene il contesto corrente in memoria.

---

## LLMProfile

Profilo OpenAI-compatible:

- `provider`: sempre `openai-compatible`.
- `baseUrl`
- `apiKey`
- `model`
- `temperature`
- `maxTokens`

---

## Task

Unita' di lavoro estratta dai marker AI.

Campi principali:

- `id`: ID deterministico dopo normalizzazione.
- `title`
- `description`
- `source`: origine, per esempio `ts` o `md`.
- `file`
- `line`
- `relatedFiles`
- `analysis`
- `status`
- `result`
- `blocker`
- `codeSnippet`
- `projects`

Status possibili:

- `TODO`
- `DONE`
- `FAILED`
- `INTERRUPTED`
- `BLOCKED`
- `DEFERRED`

`blocker` descrive requisiti esterni come dipendenze mancanti, accessi mancanti o requisiti non disponibili.
`analysis` contiene il piano operativo prodotto prima dell'esecuzione.
`DEFERRED` indica che il task non e' stato eseguito perche' appartiene a un blocco successivo fermato da un blocco precedente con errori.

---

## TaskBlock

Gruppo ordinato di task pianificati dopo l'estrazione e prima dell'esecuzione.

Campi principali:

- `id`
- `title`
- `targetDir`
- `tasks`

Se un blocco chiude con errori, i blocchi successivi vengono salvati come file Markdown in `.ai/<run>/deferred-task-blocks/` per poter essere reinseriti in una run futura.

---

## BuildResult

Risultato di validazione build:

- `success`
- `exitCode`
- `stdout`
- `stderr`
- `durationMs`

---

## GitRemoteUpdates

Delta remoto rilevato sul branch base:

- `branch`
- `commits`
- `files`
- `error`

---

## RunContext

Contesto statico della run:

- `runId`
- `repoId`
- `branchName`
- `triggerCommit`
- `startedAt`

---

## RunSnapshot

Snapshot runtime usato anche negli audit event:

- `phase`
- `status`
- `shuttingDown`
- `context`
- `currentTask`
- `attempt`

Fasi:

- `IDLE`
- `BOOTSTRAP`
- `CONTEXT_EXTRACTION`
- `TASK_EXTRACTION`
- `TASK_EXECUTION`
- `FINALIZATION`
- `DONE`
- `FAILED`

Status run:

- `RUNNING`
- `STOPPED`
- `FAILED`
- `COMPLETED`
- `INTERRUPTED`

---

## AuditEvent

Envelope pubblicato via MQTT:

- `type`
- `ts`
- `app`
- `version`
- `repoId`
- `runId`
- `branch`
- `topic`
- `snapshot`
- `payload`

Tipi evento:

- `run.event`
- `run.status`
- `task.status`
- `task.attempt`
- `task.build`
- `task.tool`
- `task.llm`

---

## RunReport

Report markdown interno usato da `RunLoggerService`.

Contiene:

- metadati run
- statistiche aggregate
- risultato install
- eventi run
- log task

Ogni `RunReportTask` conserva tentativi, chiamate LLM/tool, file toccati ed eventi task.
