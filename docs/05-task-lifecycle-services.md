# node-droid — Task Lifecycle Services

---

## task-extraction.service.ts

### Nome
TaskExtractionService

### Responsabilità
- Estrae task da contenuti umani / semi-strutturati
- Supporta:
  - commenti `ai:` nei file `.ts`
  - File `ai-tasks.md`
- Ritorna task grezzi

### Input
- File path
- Contenuto file
- Metadati

### Output
- Lista di RawTask

### Dipendenze
- `TaskParsers`

### Non deve fare
- Non deve deduplicare
- Non deve ordinare
- Non deve assegnare ID finali deterministici
- Non deve eseguire task
- Non deve modificare file

---

## task-normalization.service.ts

### Nome
TaskNormalizationService

### Responsabilità
- Deduplica task
- Assegna ID deterministici
- Normalizza campi
- Ordina task
- Normalizza `relatedFiles`

### Input
- Lista RawTask

### Output
- Lista Task normalizzati

### Dipendenze
- `crypto`

### Non deve fare
- Non deve parlare con LLM
- Non deve eseguire task
- Non deve scrivere file
- Non deve interagire con Git

---

## task-queue.service.ts

### Nome
TaskQueueService

### Responsabilità
- Mantiene stato dei task
- Espone `next()`
- Espone `load()`, `mark()` e `list()`
- Tiene traccia di `TODO` / `DONE` / `FAILED` / `BLOCKED` / `INTERRUPTED`

### Input
- Lista Task normalizzati

### Output
- Task corrente
- Indice task
- Stato task

### Dipendenze
- Nessuna

### Non deve fare
- Non deve eseguire task
- Non deve parlare con LLM
- Non deve modificare file
- Non deve scrivere log

---

## Task Outcomes

Gli outcome supportati dal sistema sono:

- `DONE`: il task e' stato completato e la build e' passata
- `FAILED`: il task non e' stato completato nel perimetro attuale
- `BLOCKED`: il task richiede un input esterno o una nuova dipendenza e non deve essere forzato con workaround scadenti
- `INTERRUPTED`: il task e' stato fermato per shutdown o stop della run
