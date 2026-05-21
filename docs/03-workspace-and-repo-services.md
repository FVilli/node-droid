# node-droid — Workspace & Repo Services

---

## workspace.service.ts

### Nome
WorkspaceService

### Responsabilità
- Scansiona la cartella `ENV.WORKSPACE_FOLDER`
- Scopre i repository disponibili
- Valida la struttura di ogni repo
- Carica e parse `repo.yml`
- Espone la lista dei repo disponibili

### Input
- ENV.WORKSPACE_FOLDER

### Output
- Lista di RepoDescriptor (id, path, config grezza)
- Errori di struttura (repo malformati)

### Dipendenze
- fs
- path
- YAML parser

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
- Mantiene in memoria il contesto del repo attivo finche' la run e' in corso

### Input
- RepoDescriptor (da WorkspaceService)
- profilo LLM grezzo o override da `repo.yml`
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
