# node-droid

**Assistente AI autonomo per repository Git e monorepo Node.js**

node-droid e' un worker headless che monitora repository Git configurati, rileva commit trigger, estrae task da codice o markdown, li esegue con un LLM compatibile OpenAI e tool locali, valida con i normali script di package, scrive log di audit e apre una pull request.

## A cosa serve

node-droid non e' pensato come assistente interattivo da usare minuto per minuto mentre si scrive codice. Per quel tipo di lavoro e' meglio un editor agentico, una chat di sviluppo o un copilota integrato nell'IDE.

node-droid e' progettato per lo **sviluppo agentico in background**: lavori che si descrivono con relativa facilita', ma che poi esplodono in molti passaggi tecnici, file, controlli e revisioni. Invece di tenere una sessione interattiva aperta, lo sviluppatore consegna al repository un'intenzione esplicita e lascia che il worker la trasformi in una PR osservabile.

Esempi adatti:

- migrazioni progressive tra librerie, framework o pattern architetturali;
- refactoring grandi ma meccanici, dove la direzione e' chiara e l'esecuzione e' lunga;
- riallineamento di API, naming, struttura cartelle o convenzioni di progetto;
- introduzione ripetitiva di test, logging, validazioni o gestione errori;
- aggiornamenti di paradigma, per esempio spostare logica da servizi legacy a helper piu' piccoli;
- manutenzione su monorepo dove una singola richiesta produce task separati su package diversi.

Il punto non e' sostituire la revisione umana. Il punto e' spostare il lavoro faticoso e segmentabile in un processo tracciato: node-droid analizza, pianifica, modifica, valida, scrive audit e apre una PR. Lo sviluppatore resta responsabile di accettare, correggere o respingere il risultato.

Non e' invece ideale per:

- micro-modifiche che richiedono feedback immediato;
- esplorazioni ambigue dove la direzione cambia ogni pochi minuti;
- debug interattivo con molte ipotesi rapide;
- decisioni di prodotto o design che richiedono giudizio umano continuo.

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
- **Gate di build**: dopo ogni task esegue lo script `build` dei package toccati, se presente.
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
- `BuildService`: esegue install mirato e build standard dei package toccati.
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

## Modalita' auto-develop

La modalita' `auto-develop` serve a far lavorare un'istanza locale di
node-droid su un clone di node-droid stesso, senza tenere il workspace dentro
questo repository.

Avvio:

```bash
./run-node-droid-local.sh
```

Lo script:

1. calcola la root del repository sorgente, per esempio `node-droid`;
2. crea un workspace fratello aggiungendo il suffisso `_workspace`, per esempio
   `../node-droid_workspace`;
3. crea la cartella `node-droid-self/` dentro quel workspace;
4. copia `develop-config.yml` in `../node-droid_workspace/node-droid-self/repo.yml`;
5. avvia `npm start` da `core/`, senza live reload.

`develop-config.yml` e' la configurazione sorgente versionata per questa
modalita'. Il file `repo.yml` dentro il workspace e' generato a ogni avvio e
puo' essere ricreato senza perdere la configurazione.

Il clone operativo resta in:

```text
../node-droid_workspace/node-droid-self/code/
```

Il flusso consigliato e':

1. avviare `./run-node-droid-local.sh` in un terminale;
2. creare task nel repository sorgente con commenti `[ai]` o `ai-tasks.md`;
3. committare e pushare sul branch monitorato con `[ai]` nel messaggio;
4. lasciare che node-droid crei un branch `ai/<runId>` e apra la PR;
5. revisionare manualmente la PR prima di accettarla.

Prerequisiti:

- Node.js 20+
- Docker e Docker Compose, opzionali
- endpoint LLM OpenAI-compatible, per esempio vLLM, Ollama o simili

## Gate di build

node-droid mantiene il gate di build volutamente semplice:

1. dopo ogni task guarda i file toccati;
2. per i file di codice e per i `package.json` cerca il `package.json` piu' vicino;
3. se quel package contiene `scripts.build` e il file toccato e' `package.json`, esegue prima `npm run install` quando esiste `scripts.install`, altrimenti `npm i`;
4. se quel package contiene `scripts.build`, esegue `npm run build`;
5. se nessun package rilevante espone `scripts.build`, salta il gate e registra lo skip nei log.

Non esistono configurazioni speciali di build nel `repo.yml`. Il contratto e'
lo script standard `build` del package; l'install viene eseguito solo quando
cambia `package.json` e c'e' un build da validare.

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
