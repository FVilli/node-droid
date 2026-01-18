# node-droid — Logging & Audit

---

## run-logger.service.ts

### Nome
RunLoggerService

### Responsabilità
- Crea il file `run-<id>.md`
- Scrive sezioni
- Appende eventi
- Inserisce snapshot
- Finalizza il log

### Input
- Eventi
- Snapshot
- Output servizi

### Output
- File markdown

### Dipendenze
- fs
- path
- RepoContextService

### Non deve fare
- Non deve orchestrare
- Non deve chiamare LLM
- Non deve eseguire task

---

## artifact.service.ts

### Nome
ArtifactService

### Responsabilità
- Salva artefatti pesanti:
  - diff
  - stdout
  - stderr
- Collega al log

### Input
- Blob di testo

### Output
- File

### Dipendenze
- fs
- path

### Non deve fare
- Non deve orchestrare
- Non deve chiamare LLM
