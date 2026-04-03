# node-droid — Merge Request

---

## merge-request.service.ts

### Nome
MergeRequestService

### Responsabilità
- Crea merge request
- Imposta titolo deterministico
- Compila descrizione dalla run summary
- Delega la creazione della PR a `GitService`

### Input
- Base branch
- Run branch
- Run ID
- Token opzionale

### Output
- MR URL

### Dipendenze
- GitService

### Non deve fare
- Non deve eseguire task
- Non deve chiamare LLM
- Non deve modificare file
