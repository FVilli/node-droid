# node-droid — Merge Request

---

## merge-request.service.ts

### Nome
MergeRequestService

### Responsabilità
- Crea merge request
- Imposta titolo deterministico
- Compila descrizione
- Aggiunge summary
- Imposta stato

### Input
- RepoContext
- Run summary
- Branch

### Output
- MR URL
- MR ID

### Dipendenze
- GitService

### Non deve fare
- Non deve eseguire task
- Non deve chiamare LLM
- Non deve modificare file
