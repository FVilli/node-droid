# 🤖 node-droid

**Il tuo assistente AI autonomo per monorepo Node.js**

node-droid e' un agente di sviluppo autonomo che monitora i tuoi repository Git, estrae task da codice e markdown, li esegue con un LLM + tool, valida con una build e apre una PR con un audit log completo.

Versione inglese: `README.md`

## ✨ Funzionalita'

- 🔍 **Trigger basato su commit** - Osserva i commit con `[ai]` e avvia una run
- 🧠 **Estrazione task** - Analizza i task solo dai file nel commit di trigger
- 🤖 **Loop di esecuzione LLM** - Esegue i task con chiamate tool e retry
- ✅ **Gate di build** - Esegue la build dopo ogni task, con retry di fix in caso di errore
- 📊 **Log di esecuzione dettagliati** - Report Markdown completi in `.ai/` con contesto dei task
- 🧠 **Consapevolezza del contesto di progetto** - Contesto basato su Repomix per prompt migliori
- 📌 **Istruzioni AI** - Direttive `ai-instructions.md` a livello root e cartella
- 🧹 **Pulizia marker task** - Rimuove `ai.md` e commenti task dopo l'elaborazione
- 🧾 **PR sempre creata** - Apre una PR anche se i task falliscono (decide lo sviluppatore)

## 🧠 Come Funziona (Logica)

Ogni run segue un flusso di lavoro rigoroso e non interattivo:
1. Sincronizza il branch target dal remoto e cerca i commit di trigger che includono `[ai]`.
2. Limita l'estrazione dei task solo ai file modificati in quei commit (per velocita' e precisione).
3. Se vengono trovati task, crea un branch dedicato ed esegue i task in ordine.
4. Un task e' considerato riuscito solo se la build passa dopo le sue modifiche.
5. La run apre sempre una pull request, anche se uno o piu' task falliscono.

node-droid e' intenzionalmente headless: e' un worker in background pensato per task piccoli e ben definiti comunicati via Git. Tutta l'attivita' e' documentata nella cartella `.ai/` alla root del repository, inclusi riepiloghi, stato dei task e contesto di esecuzione.

## 🧠 Come Funziona (Codice)

node-droid orchestra una run completa combinando servizi dedicati:
- `WorkspaceService` e `RepoContextService` caricano configurazione e path del repo
- `GitService` mantiene il clone locale allineato al remoto
- `TaskExtractionService` estrae i task dai file committati
- `TranslateToEnglishService` normalizza titoli/descrizioni dei task
- `PromptTemplateService`, `PromptService`, `AIInstructionsService` e `RepomixService` costruiscono il contesto finale del prompt
- `LLMProfileResolverService` e `LLMClientService` gestiscono le chiamate al modello
- `ToolRegistryService` esegue le invocazioni tool
- `ScriptsService` esegue le build
- `RunStateService` coordina lo stato del ciclo di vita
- `RunLoggerService` produce i log Markdown e i riepiloghi

## 🚀 Quick Start (Self-Hosted)

Questo e' il modo piu' semplice per eseguire node-droid.

Se vuoi eseguire node-droid senza clonare questo repo, puoi usare un'immagine Docker e un `docker-compose.yml` locale.
Crea una cartella con `workspace/` e un `docker-compose.yml`, poi avvia il container.

Esempio `docker-compose.yml` (aggiorna `image:` con il nome della tua immagine pubblicata):
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

Poi:
```bash
docker-compose up -d
```

Compila `./workspace/<repo-id>/repo.yml` come descritto sotto e node-droid iniziera' a monitorare.

### Volume workspace + repo.yml

node-droid scansiona `WORKSPACE_FOLDER` (default: `/app/workspace` in Docker).
Ogni repo che vuoi monitorare deve vivere in una propria cartella con un file `repo.yml`.
Il repo viene clonato in una sottocartella `code/` dentro quella cartella.

Esempio struttura:
```
/app/workspace/
└── mqtt-archiver/
    ├── repo.yml
    └── code/            # git clone avviene qui
```

Esempio mapping volume in `docker-compose.yml`:
```yaml
services:
  node-droid:
    volumes:
      - ./workspace:/app/workspace
```

Esempio `repo.yml` (commenti supportati):
```yaml
# REQUIRED: remoto git da clonare
remote: git@github.com:org/repo.git
# REQUIRED: branch base da monitorare
baseBranch: main

# OPTIONAL: override di ENV.BUILD_COMMAND / BUILD_CMD
buildCommand: npm run build

# OPTIONAL: token GitHub per creazione PR (puo' usare anche GH_TOKEN env)
token: ghp_xxx

# OPTIONAL: override dei valori LLM_* quando forniti
llm:
  baseUrl: http://localhost:8000/v1
  apiKey: dummy
  model: gpt-4o-mini
  temperature: 0.2
  maxTokens: 4096

# OPTIONAL: override dei valori policy agent
agent:
  maxTaskRetries: 3        # override di MAX_TASK_RETRIES
  stopOnFailure: false     # riservato a comportamenti futuri
  maxToolCallsPerTask: 30  # override di MAX_TOOL_CALLS_PER_TASK

# OPTIONAL: impostazioni Repomix (usato solo se repomix e' installato nel repo)
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

# OPTIONAL: override di AI_COMMIT_TAG se fornito
triggers:
  commitPrefix: "[ai]"
```

Nota: la creazione della PR usa attualmente la GitHub CLI (`gh`), quindi sono supportati solo remoti GitHub.

## 🛠️ Come Sviluppare & Contribuire

### Prerequisiti

- Node.js 20+
- Docker & Docker Compose (opzionale, per test containerizzati)
- Un endpoint API LLM (vLLM, Ollama o compatibile con OpenAI)

### Installazione

1. Clona il repository:
```bash
git clone https://github.com/your-org/node-droid.git
cd node-droid
```

2. Installa le dipendenze:
```bash
cd core
npm install
```

3. Configura l'ambiente:
```bash
cp .env.example .env
# Modifica .env con le tue impostazioni
```

4. Build:
```bash
npm run build
```

5. Avvio:
```bash
npm start
```

## 📖 Uso

## Verifica Build tramite `.ai/build-instructions.yml`

Node-droid esegue automaticamente una **verifica di build** dopo ogni task, per assicurarsi che le modifiche introdotte non abbiano rotto il progetto.

Per evitare qualsiasi assunzione implicita o inferenza automatica (deterministica o tramite LLM), **la logica di build e' interamente dichiarativa** ed e' fornita dall'utente tramite un file di configurazione.

---

### File di Configurazione

Il file deve essere posizionato in:
```
.ai/build-instructions.yml
```

Questo file descrive:
- quali parti del repository (unit) esistono
- come riconoscere quali unit sono state toccate
- l'ordine di build tramite dipendenze esplicite
- i comandi da eseguire (`install`, `build`)
- la directory di esecuzione di ciascun comando

Node-droid **non deduce nulla** dalla struttura del progetto: esegue esclusivamente cio' che e' dichiarato in questo file.

---

### Concetti Chiave

#### Unit

Una *unit* rappresenta una porzione logica del repository:
- un'applicazione
- una libreria
- un progetto singolo (nel caso non monorepo)

Ogni unit e' identificata da:
- un nome
- un `path` assoluto rispetto alla root del repository
- eventuali dipendenze (`dependsOn`)
- comandi di `install` e `build`

---

### Semantica dei Path

- Tutti i `path` sono **assoluti rispetto alla root del repository**
- La root del repository e' identificata da `/`

Esempi:

| Tipo progetto | path |
|--------------|------|
| Single-repo | `/` |
| Monorepo lib | `/libs/core-utils` |
| Monorepo app | `/apps/api` |

Una unit e' considerata *toccata* se almeno un file modificato ha un path che inizia con `unit.path`.

---

### Install e Build

#### Install Globale

Se presente, `global.install` viene **sempre eseguito una volta**, indipendentemente dalle unit toccate.

Serve a garantire che le dipendenze del workspace siano allineate.

#### Install della Unit

Se una unit e' stata toccata **e** dichiara un proprio `install`, anche questo comando viene eseguito.

L'`install` della unit **non sostituisce** il global install: e' additivo.

#### Build

Ogni unit coinvolta nel grafo di build (toccata direttamente o richiesta come dipendenza) viene buildata.

---

### Dipendenze tra Unit

Le dipendenze sono dichiarate esplicitamente tramite `dependsOn`.

Node-droid:
1. individua le unit toccate
2. risolve ricorsivamente tutte le dipendenze
3. costruisce un grafo aciclico
4. esegue la build in ordine topologico

In presenza di:
- dipendenze mancanti
- cicli nel grafo

il processo fallisce immediatamente.

---

### Esempio: Progetto Semplice (Non monorepo)

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

---

### Esempio: Monorepo

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

---

### Principi di Design

- Nessuna inferenza automatica
- Nessuna dipendenza da LLM
- Comportamento 100% deterministico
- Stessa logica per single-repo e monorepo
- Il file `.ai/build-instructions.yml` e' la **fonte di verita' unica**

Se la build e' errata, la causa e' nel file di configurazione, non in node-droid.

---

## Come Assegnare Task a node-droid

### 1. Aggiungi Commenti Task

Aggiungi commenti dove e' necessario il cambiamento. Usa `ai:` per il titolo del task, poi aggiungi linee descrittive opzionali con `//`.
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
La prima riga di codice immediatamente dopo il commento task e' inclusa come contesto della richiesta.

### 2. Aggiungi ai.md (Opzionale, per liste task)

Posiziona `ai.md` in `src/` o in qualsiasi sottocartella per definire una lista di task.
Ogni task e' un bullet, e puoi aggiungere una descrizione con un blocco indentato multilinea.
```markdown
## AI Tasks

- Create authentication service in `apps/backend/src/auth`
- Implement JWT token generation
  Add refresh token flow and expiry handling
- Add login and register endpoints | Return 401 on invalid credentials
- Create auth guards for protected routes
```

### 3. Aggiungi ai-instructions.md (Opzionale, direttive)

Puoi aggiungere un `ai-instructions.md` nella root del repo e/o in qualsiasi sottocartella.
Le istruzioni root sono incluse per ogni task. Le istruzioni di cartella sono incluse solo per i task in quella cartella.
```markdown
## Project Rules
- Use pnpm, not npm
- Prefer zod for schema validation
- Keep changes minimal and focused
```

### 4. Commit con Tag AI

Solo i file coinvolti nel commit vengono scansionati per i task.
Il tag e' solo un trigger e viene rimosso dai titoli delle run e dei summary.
```bash
git commit -m "[ai] Add user authentication feature"
```

### 5. Push e osserva

```bash
git push origin develop
```

node-droid:
1. Rileva il commit `[ai]`
2. Estrae i task solo dai file inclusi nel commit (commenti e ai.md)
3. Esegue ogni task (puo' leggere/modificare qualsiasi file del repo mentre lavora)
4. Esegue la build dopo ogni task (con retry di fix in caso di errore)
5. Aggiorna i marker dei task nei commenti e rimuove `ai.md`
6. Crea una merge request (anche se alcuni task falliscono)

Nota: i marker dei task nei commenti vengono sostituiti con righe di stato ✅/❌, mentre i file `ai.md` vengono rimossi dopo l'elaborazione; la definizione completa dei task e gli output sono preservati nel report di run sotto `.ai/`.

## 📁 Log Attivita'

Tutte le attivita' sono registrate in `.ai/`:
```
.ai/
├── 2026-01-17 14.30_281740.md
├── 2026-01-17 15.22_281741.md
```

Ogni log contiene:
- Riepilogo run (tempi, tentativi, conteggi LLM/tool, file toccati)
- Timeline task-per-task con prompt, tool call e output di build
- Definizioni e stati completi dei task

## ⚙️ Configurazione

### Variabili d'ambiente

| Variabile | Descrizione | Default |
|----------|-------------|---------|
| `WORKSPACE_FOLDER` | Root del workspace | `../workspace` |
| `WATCH_INTERVAL` | Intervallo di polling (ms) | `60000` |
| `LLM_API_URL` | Endpoint API LLM | `http://localhost:8000/v1` |
| `LLM_API_KEY` | Chiave API LLM | `dummy` |
| `LLM_MODEL` | Modello da usare | `gpt-4o-mini` |
| `LLM_TEMPERATURE` | Temperatura del modello | `0.2` |
| `LLM_MAX_TOKENS` | Token massimi | `4096` |
| `BUILD_CMD` | Comando di build | `npm run build` |
| `MAX_TASK_RETRIES` | Retry per task | `3` |
| `MAX_TOOL_CALLS_PER_TASK` | Limite chiamate tool | `30` |
| `AI_COMMIT_TAG` | Tag di trigger commit | `[ai]` |
| `AI_TODO_FILE` | Nome file task | `ai.md` |
| `AI_TODO_COMMENT` | Tag commento task | `ai:` |
| `AI_BRANCH_PREFIX` | Prefisso branch | `ai` |
| `DRY_RUN` | Disabilita LLM + side effects remoti | `false` |
| `GH_TOKEN` | Token GitHub per creazione PR | non impostato |

### Integrazione Repomix

Repomix e' configurato per repo via `repo.yml` ed e' usato solo quando `repomix.enabled: true`.
Se abilitato ma il pacchetto manca nel repository target, node-droid registra un warning e continua senza di esso.

Aggiungi al `package.json` del repository target:
```json
{
  "devDependencies": {
    "repomix": "^0.1.0"
  }
}
```

node-droid usera' automaticamente Repomix se disponibile per fornire un contesto di progetto migliore al LLM.

## 🏗️ Architettura
```
node-droid/
├── Workspace Scanner  # Scoperta repo
├── Task Extraction    # Legge ai.md e commenti ai:
├── Task Executor      # Loop LLM + tool + retry build
├── Run Logger         # Report Markdown completo in .ai/
└── Repomix Service    # Generazione contesto di progetto
```

## 📝 Licenza

MIT

## 🤝 Contribuire

I contributi sono benvenuti! Apri una issue o invia una pull request.

## ⚠️ Disclaimer

node-droid e' uno strumento sperimentale. Rivedi sempre il codice generato dall'AI prima di fare merge in produzione.

---

**Creato con ❤️ per la comunita' Node.js**
