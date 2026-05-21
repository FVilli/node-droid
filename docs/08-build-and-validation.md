# node-droid — Build & Validation

---

## build.service.ts

### Nome
BuildService

### Responsabilità
- Esegue il comando di build configurato
- Normalizza output
- Restituisce successo/fallimento con durata, stdout, stderr ed exit code
- Esegue install/build per package quando il task ha toccato file dentro package rilevabili da `package.json`
- Usa `npm run build` per i package rilevati
- Usa il comando `install` del package se presente, altrimenti `npm install`

### Input
- RepoContext
- lista di package directory quando la validazione e' limitata ai package toccati

### Output
- BuildResult:
  - success
  - stdout
  - stderr
  - exitCode
  - durationMs

### Dipendenze
- child_process `execSync`
- RepoContextService
- RunLoggerService
- BuildHelpers

### Non deve fare
- Non deve chiamare LLM
- Non deve applicare patch
- Non deve orchestrare

### Stato attuale

Il servizio non legge ancora `.ai/build-instructions.yml`. La validazione attuale segue due strade:

1. build globale con `ENV.BUILD_CMD`
2. install/build dei package che contengono file modificati dal task

Se viene introdotta la build dichiarativa descritta nel README, questo documento e `BuildService` devono essere aggiornati insieme.
