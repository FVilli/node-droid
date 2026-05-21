# node-droid — Git Service

---

## git.service.ts

### Nome
GitService

### Responsabilità
- Incapsula tutte le operazioni Git
- Fornisce API deterministiche
- Ritorna output Git testuale o strutture mirate dove previsto
- Gestisce errori Git

### Operazioni supportate
- clone
- pull
- fetch
- checkout branch
- create branch
- get remote delta (commit e file modificati)
- get HEAD sha
- get HEAD subject
- commit
- push
- create pull request tramite GitHub CLI

### Input
- Path del repo
- Parametri di comando

### Output
- Strutture normalizzate
- stdout testuale per i comandi diretti
- errori intercettati per remote delta

### Dipendenze
- child_process `execSync`
- RepoContextService
- RunLoggerService

### Non deve fare
- Non deve decidere flusso
- Non deve orchestrare
- Non deve parlare con LLM
- Non deve scrivere log markdown
- Non deve gestire retry di task
