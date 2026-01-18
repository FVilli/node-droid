# node-droid — Git Service

---

## git.service.ts

### Nome
GitService

### Responsabilità
- Incapsula tutte le operazioni Git
- Fornisce API deterministiche
- Normalizza output Git
- Gestisce errori Git

### Operazioni supportate
- clone
- pull
- fetch
- checkout branch
- create branch
- get diff
- list changed files
- get commit message
- commit
- push
- create merge request

### Input
- Path del repo
- Parametri di comando

### Output
- Strutture normalizzate
- stdout / stderr
- exit code

### Dipendenze
- child_process / execa
- RepoContextService

### Non deve fare
- Non deve decidere flusso
- Non deve orchestrare
- Non deve parlare con LLM
- Non deve scrivere log markdown
- Non deve gestire retry di task
