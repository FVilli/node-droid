# node-droid - Development Guide

Guida rapida per sviluppo locale.

---

## Prerequisiti

- Node.js 20+.
- npm.
- Docker e Docker Compose per prove containerizzate.
- Endpoint LLM OpenAI-compatible per run reali.
- GitHub CLI se si testano PR.

---

## Setup

Il monorepo oggi contiene solo `core/`.

Installazione:

```bash
cd core
npm install
```

Comandi principali:

```bash
npm run build
npm test
npm run lint
npm run format
npm run docs
```

Avvio locale:

```bash
npm start
npm run start:dev
```

---

## Dove lavorare

- `core/src/services/`: servizi NestJS e confini applicativi.
- `core/src/helpers/`: logica deterministica o funzioni di supporto.
- `core/src/libs/`: utility condivise.
- `core/src/types.ts`: contratti dati.
- `docs/`: documentazione architetturale e operativa.

Preferire pattern esistenti:

- orchestration nei servizi
- parsing/formatting/helper deterministici in `helpers/`
- tipi condivisi in `types.ts`
- wiring provider in `app.module.ts`

---

## Validazione

Per modifiche TypeScript:

```bash
cd core
npm run build
```

Quando si tocca logica testabile:

```bash
npm test
```

Quando si modificano import, stile o regole lint:

```bash
npm run lint
```

Per rigenerare API docs:

```bash
npm run docs
```

Output TypeDoc:

```text
core/docs/api/
```

Non modificare manualmente `core/docs/api/`.

---

## Workspace locale per run

Default locale:

```text
../workspace
```

Esempio:

```text
../workspace/
  target-repo/
    repo.yml
    code/
```

`code/` viene clonato da `GitService` se assente.

---

## Regole di modifica

- Aggiornare docs quando cambia comportamento pubblico.
- Non introdurre parallelismo senza cambiare esplicitamente gli invarianti.
- Non far parlare servizi non dedicati direttamente con LLM o Git.
- Tenere `BuildService` deterministico e separato dall'LLM.
- Evitare nuovi moduli NestJS custom salvo cambio architetturale intenzionale.
- Non usare `core/docs/api/` come fonte da editare: e' generata.

---

## Debug rapido

Problemi comuni:

- Nessun repo trovato: controllare `WORKSPACE_FOLDER` e presenza di `repo.yml`.
- Nessuna run: controllare commit con `[ai]` e file modificati nel delta remoto.
- Nessun task estratto: controllare marker `ai:` nei `.ts` o `ai-tasks.md`.
- Build fallita: controllare `ENV.BUILD_CMD`, package rilevati e output in `.ai/`.
- PR fallita: controllare `gh`, token e remote GitHub.
- Audit assente: controllare `MQTT_AUDIT_ENABLED` e URL broker.
