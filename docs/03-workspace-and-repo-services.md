# node-droid — Workspace & Repo Services

---

## workspace.service.ts

### Nome
WorkspaceService

### Responsabilità
- Scansiona la cartella `ENV.FOLDER_STORAGE`
- Scopre i repository disponibili
- Valida la struttura di ogni repo
- Carica e parse `repo.yml`
- Espone la lista dei repo disponibili

### Input
- ENV.FOLDER_STORAGE

### Output
- Lista di RepoDescriptor (id, path, config grezza)
- Errori di struttura (repo malformati)

### Dipendenze
- fs
- path
- JSON parser

### Non deve fare
- Non deve clonare repo
- Non deve parlare con Git
- Non deve chiamare LLM
- Non deve decidere quale repo processare
- Non deve scrivere file

---

## repo-context.service.ts

### Nome
RepoContextService

### Responsabilità
- Gestisce il contesto del repo attivo
- Normalizza la configurazione:
  - ENV defaults
  - override da repo.yml
- Espone path assoluti:
  - root repo
  - cartella `code/`
  - cartella `.ssh/`
  - cartella `.ai/`
- Espone la configurazione finale risolta

### Input
- RepoDescriptor (da WorkspaceService)
- ENV

### Output
- RepoContext normalizzato
- Path assoluti sicuri

### Dipendenze
- WorkspaceService
- env.ts

### Non deve fare
- Non deve clonare repo
- Non deve chiamare Git
- Non deve chiamare LLM
- Non deve leggere/scrivere file applicativi
- Non deve gestire task
