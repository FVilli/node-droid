# node-droid

**Assistente AI autonomo per repository Git e monorepo Node.js**

node-droid e' un worker headless che monitora repository Git configurati, rileva commit trigger, estrae task da codice o markdown, li esegue con un LLM compatibile OpenAI e tool locali, valida con build dichiarative, scrive log di audit e apre una pull request.

## Idea di Base

Il ciclo e' semplice:

1. node-droid clona un progetto e ascolta i commit sul branch configurato.
2. Si attiva solo quando trova condizioni esplicite, per esempio un commit con `[ai]`.
3. Individua i task nei file modificati, tramite commenti `[ai]` o `ai-tasks.md`, poi fa un controllo LLM sul risultato.
4. Raggruppa i task in blocchi coerenti: se un blocco fallisce, quelli successivi non vengono eseguiti.
5. Analizza ogni task, produce un piano osservabile, poi lo esegue in un branch dedicato usando LLM, tool locali e build di verifica.
6. Pubblica il risultato aprendo una PR o MR con log, audit della run e task non eseguiti riutilizzabili.

L'obiettivo e' lasciare allo sviluppatore un flusso Git normale: descrivi il lavoro nel codice o in markdown, fai commit con il trigger, poi revisioni la PR/MR generata.

## Funzionalita'

- **Trigger via commit**: osserva commit che contengono `[ai]`.
- **Estrazione task mirata**: legge solo i file inclusi nei commit trigger.
- **Task da commenti o markdown**: supporta commenti `[ai]` nei file `.ts` e liste in `ai-tasks.md`.
- **Controllo LLM sui task**: dopo il parser deterministico, un agente-controllore verifica il risultato file per file.
- **Task a blocchi**: dopo l'estrazione i task vengono raggruppati; il fallimento di un blocco ferma i blocchi successivi.
- **Istruzioni standard**: usa `AGENTS.md` a root e cartella come fonte unica di istruzioni per agenti.
- **Analisi prima dell'esecuzione**: per ogni task produce un piano operativo osservabile prima di modificare file.
- **Recupero lavoro non eseguito**: i blocchi non eseguiti vengono salvati nella documentazione della run come file Markdown pronti da reinserire.
- **Loop LLM + tool**: esegue modifiche con tool mirati e retry.
- **Gate di build**: valida dopo ogni task tramite `.ai/build-instructions.yml` del repo target.
- **Audit completo**: produce report Markdown in `.ai/` ed eventi MQTT opzionali.
- **PR sempre creata**: apre una PR anche se alcuni task falliscono o restano bloccati.

## Come Funziona

Ogni run segue un flusso non interattivo:

1. Sincronizza il branch base dal remoto.
2. Cerca commit che includono `[ai]`.
3. Scansiona solo i file modificati da quei commit.
4. Estrae task da commenti `[ai]` nei `.ts` e da `ai-tasks.md`, quindi chiede a un agente-controllore LLM di correggere eventuali omissioni o falsi positivi.
5. Raggruppa i task in blocchi coerenti, per esempio per file o cartella di origine.
6. Crea un branch dedicato alla run.
7. Per ogni blocco esegue tutti i task in ordine; se uno o piu' task falliscono o restano bloccati, la run non procede ai blocchi successivi.
8. Per ogni task fa una fase di analisi read-only, registra il piano operativo, poi esegue con LLM e tool.
9. Esegue la build dopo ogni task.
10. Aggiorna marker task, rimuove `ai-tasks.md` processati, scrive log e apre una PR.

I blocchi successivi non eseguiti vengono marcati come `DEFERRED` e salvati nella cartella della run sotto `.ai/<run>/deferred-task-blocks/`. Ogni file contiene una lista Markdown pronta da rimettere in un `ai-tasks.md` del repo target.

Un task e' riuscito solo se la build passa dopo le sue modifiche. Se richiede dipendenze mancanti, accessi o requisiti esterni, puo' terminare come `BLOCKED` invece di forzare workaround fragili.

## Architettura Codice

Il runtime vive in `core/` ed e' organizzato in servizi NestJS:

- `WorkspaceService` e `RepoContextService`: caricano configurazione e path del repo.
- `GitService`: mantiene il clone locale allineato al remoto.
- `TaskExtractionService`: estrae task dai file committati.
- `TranslateToEnglishService`: normalizza titoli e descrizioni task.
- `AIInstructionsService`, `PromptTemplateService`, `PromptService`: costruiscono i messaggi per il modello usando `AGENTS.md`.
- `LLMProfileResolverService` e `LLMClientService`: gestiscono profilo e chiamate LLM.
- `ToolRegistryService`: esegue tool locali, preferendo operazioni mirate su file.
- `BuildService`: esegue install/build dichiarate.
- `RunStateService`: coordina lo stato della run.
- `RunLoggerService` e `AuditPublisherService`: producono log Markdown ed eventi MQTT.
- `MergeRequestService`: crea la pull request.

## Quick Start Docker

Crea una cartella con `workspace/` e un `docker-compose.yml`:

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
      MQTT_AUDIT_ENABLED: "true"
      MQTT_AUDIT_URL: "mqtt://host.docker.internal:1883"
      MQTT_AUDIT_TOPIC_PREFIX: "node-droid/audit"
```

Avvio:

```bash
docker-compose up -d
```

node-droid scansiona `WORKSPACE_FOLDER`, che in Docker ha default `/app/workspace`.
Ogni repo monitorato deve stare in una propria cartella con `repo.yml`; il clone viene creato in `code/`.

Esempio:

```text
/app/workspace/
└── mqtt-archiver/
    ├── repo.yml
    └── code/
```

Esempio `repo.yml`:

```yaml
remote: git@github.com:org/repo.git
baseBranch: main

buildCommand: npm run build

token: ghp_xxx

llm:
  baseUrl: http://localhost:8000/v1
  apiKey: dummy
  model: gpt-4o-mini
  temperature: 0.2
  maxTokens: 4096

agent:
  maxTaskRetries: 3
  stopOnFailure: false
  maxToolCallsPerTask: 30

triggers:
  commitPrefix: "[ai]"
```

Nota: la creazione PR usa attualmente GitHub CLI (`gh`), quindi sono supportati solo remoti GitHub.

## Sviluppo

Comandi da eseguire da `core/`:

```bash
cd core
npm install
npm run build
npm test
npm run lint
npm run format
npm run docs
```

Avvio locale:

```bash
cd core
npm start
npm run start:dev
npm run start:prod
```

Prerequisiti:

- Node.js 20+
- Docker e Docker Compose, opzionali
- endpoint LLM OpenAI-compatible, per esempio vLLM, Ollama o simili

## Build tramite `.ai/build-instructions.yml`

node-droid valida i repository target usando esclusivamente:

```text
.ai/build-instructions.yml
```

Questo file dichiara:

- quali unita' del repository esistono
- come riconoscere quali unita' sono state toccate
- dipendenze tra unita'
- comandi di install e build
- directory di lavoro dei comandi

node-droid **non inferisce nulla** dalla struttura del progetto. Se la build e' errata, la causa e' la configurazione, non node-droid.

Esempio progetto singolo:

```yaml
version: 1

global:
  install:
    cwd: /
    cmd: npm i

units:
  app:
    type: app
    path: /
    build:
      cwd: /
      cmd: npm run build
```

Esempio monorepo:

```yaml
version: 1

global:
  install:
    cwd: /
    cmd: npm i

units:
  core-utils:
    type: lib
    path: /libs/core-utils
    build:
      cwd: /
      cmd: nest build core-utils

  auth-lib:
    type: lib
    path: /libs/auth
    dependsOn:
      - core-utils
    build:
      cwd: /
      cmd: nest build auth-lib

  api:
    type: app
    path: /apps/api
    dependsOn:
      - auth-lib
      - core-utils
    build:
      cwd: /
      cmd: nest build api
```

Regole:

- `path` e' assoluto rispetto alla root del repo, per esempio `/`, `/apps/api`, `/libs/core`.
- una unit e' toccata se un file modificato inizia con il suo `path`.
- `global.install`, se presente, viene eseguito una volta.
- le dipendenze sono risolte ricorsivamente.
- dipendenze mancanti o cicli nel grafo fanno fallire la build subito.

## Assegnare Task a node-droid

### Commenti task

Usa `[ai]` nei commenti `.ts`:

```typescript
export class UsersService {
  // [ai] Add method for soft delete of users
  // Keep backwards compatibility with existing callers
  findAll() {
    return this.userRepository.find();
  }
}
```

La prima riga di codice dopo il commento viene inclusa come contesto del task.

### Liste task

Puoi aggiungere `ai-tasks.md` in `src/` o in sottocartelle:

```markdown
## AI Tasks

- Create authentication service in `apps/backend/src/auth`
- Implement JWT token generation
  Add refresh token flow and expiry handling
- Add login and register endpoints | Return 401 on invalid credentials
```

Dopo l'elaborazione, i file `ai-tasks.md` processati vengono rimossi. Il contenuto completo resta nel report `.ai/`.

### Istruzioni agenti

Puoi aggiungere `AGENTS.md` nella root del repo target e/o in sottocartelle.
Le istruzioni root valgono per ogni task; quelle locali solo per task nella cartella relativa.

```markdown
# AGENTS.md

## Project Rules
- Use pnpm, not npm.
- Prefer zod for schema validation.
- Keep changes minimal and focused.
```

`AGENTS.md` e' la fonte unica per istruzioni e contesto operativo. Non usare file paralleli di contesto o istruzioni.

### Commit trigger

Solo i file inclusi nel commit vengono scansionati per task:

```bash
git commit -m "[ai] Add user authentication feature"
git push origin develop
```

node-droid rileva il commit `[ai]`, estrae i task, li esegue, valida la build, aggiorna i marker e crea una merge request.

## Log e Audit

I report vengono scritti nel repo target sotto `.ai/`:

```text
.ai/
├── 2026-01-17 14.30_281740.md
├── 2026-01-17 15.22_281741.md
```

Ogni report contiene:

- riepilogo run
- stato dei task
- tentativi e retry
- chiamate LLM e tool
- output di build
- file toccati

### MQTT Audit

Configurazione via environment:

```env
MQTT_AUDIT_ENABLED=true
MQTT_AUDIT_URL=mqtt://localhost:1883
MQTT_AUDIT_USERNAME=
MQTT_AUDIT_PASSWORD=
MQTT_AUDIT_CLIENT_ID=node-droid
MQTT_AUDIT_TOPIC_PREFIX=node-droid/audit
MQTT_AUDIT_QOS=0
MQTT_AUDIT_RETAIN=false
```

Topic:

```text
<MQTT_AUDIT_TOPIC_PREFIX>/<repoId>/<runId>/<eventType>
```

Eventi supportati:

- `run.event`
- `run.status`
- `task.status`
- `task.attempt`
- `task.build`
- `task.tool`
- `task.llm`

Il contratto completo e' in `docs/09-logging-and-audit.md`.

## Configurazione Environment

| Variabile | Descrizione | Default |
|----------|-------------|---------|
| `WORKSPACE_FOLDER` | Root workspace | `../workspace` |
| `WATCH_INTERVAL` | Intervallo polling ms | `60000` |
| `LLM_API_URL` | endpoint API LLM | `http://localhost:8000/v1` |
| `LLM_API_KEY` | API key LLM | `dummy` |
| `LLM_MODEL` | modello | `gpt-4o-mini` |
| `LLM_TEMPERATURE` | temperatura | `0.2` |
| `LLM_MAX_TOKENS` | token massimi | `4096` |
| `BUILD_CMD` | comando build fallback | `npm run build` |
| `MAX_TASK_RETRIES` | retry task | `3` |
| `MAX_TOOL_CALLS_PER_TASK` | limite chiamate tool per task | `30` |
| `AI_COMMIT_TAG` | tag trigger commit | `[ai]` |
| `AI_INSTRUCTIONS_FILE` | nome file istruzioni | `AGENTS.md` |
| `AI_TODO_FILE` | nome file task markdown | `ai-tasks.md` |
| `AI_TODO_COMMENT` | marker commento task | `[ai]` |
| `AI_BRANCH_PREFIX` | prefisso branch run | `ai` |
| `DRY_RUN` | disabilita LLM e side effect remoti | `false` |
| `GH_TOKEN` | token GitHub per PR | non impostato |

## Licenza

MIT

## Disclaimer

node-droid e' uno strumento sperimentale. Rivedi sempre il codice generato dall'AI prima di fare merge in produzione.
