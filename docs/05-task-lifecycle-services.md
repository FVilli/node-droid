# node-droid — Task Lifecycle Services

---

## task-extraction.service.ts

### Nome
TaskExtractionService

### Responsabilità
- Estrae task da contenuti umani / semi-strutturati
- Supporta:
  - TODO nei file .ts
  - File TODO.md
- Interagisce con LLM
- Ritorna task grezzi

### Input
- File path
- Contenuto file
- Metadati

### Output
- Lista di RawTask

### Dipendenze
- LLMClientService
- PromptTemplateService

### Non deve fare
- Non deve deduplicare
- Non deve ordinare
- Non deve assegnare ID
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
- Valida schema

### Input
- Lista RawTask

### Output
- Lista Task normalizzati

### Dipendenze
- libs (hashing, deterministic-id)

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
- Gestisce retry count
- Tiene traccia di DONE / FAILED

### Input
- Lista Task normalizzati

### Output
- Task corrente
- Stato task

### Dipendenze
- RunStateService

### Non deve fare
- Non deve eseguire task
- Non deve parlare con LLM
- Non deve modificare file
- Non deve scrivere log
