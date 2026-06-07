# node-droid — Build & Validation

---

## build.service.ts

### Nome
BuildService

### Responsabilità
- Esegue lo script `build` dei package rilevanti, quando presente
- Esegue install solo quando `package.json` e' stato toccato e lo stesso package ha `scripts.build`
- Normalizza output
- Restituisce successo/fallimento con durata, stdout, stderr ed exit code
- Salta il gate quando nessun `package.json` rilevante contiene `scripts.build`

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

### Semantica

La validazione cerca il `package.json` piu' vicino ai file di codice e ai
`package.json` toccati dal task.
Per ogni package rilevante:

1. se non esiste `scripts.build`, registra uno skip senza eseguire install;
2. se il file toccato e' `package.json`, esegue `npm run install` quando esiste `scripts.install`, altrimenti `npm i`;
3. se esiste `scripts.build`, esegue `npm run build`;
4. se nessun package rilevante ha uno script `build`, il gate e' considerato superato.

Il runtime non usa campi di build nel `repo.yml`; lo script `build` del package
e' il contratto di validazione.
