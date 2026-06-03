# node-droid — Task Lifecycle Services

---

## task-extraction.service.ts

### Nome
TaskExtractionService

### Responsabilità
- Estrae task da contenuti umani / semi-strutturati
- Usa parser deterministici come primo passaggio
- Chiede a un agente-controllore LLM di verificare il risultato per ogni file supportato
- Supporta:
  - commenti `[ai]` nei file `.ts`
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
- `LLMClientService`
- `RepoContextService`

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
- Mantiene i blocchi task pianificati
- Espone `next()` per compatibilita' con il flusso lineare
- Espone `load()`, `loadBlocks()`, `mark()`, `list()` e `listBlocks()`
- Tiene traccia di `TODO` / `DONE` / `FAILED` / `BLOCKED` / `DEFERRED` / `INTERRUPTED`

### Input
- Lista Task normalizzati
- Lista TaskBlock pianificati

### Output
- Task corrente
- Indice task
- Stato task
- Blocchi task

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
- `DEFERRED`: il task non e' stato eseguito perche' appartiene a un blocco successivo fermato da un blocco precedente con errori
- `INTERRUPTED`: il task e' stato fermato per shutdown o stop della run


---

## TaskBlock

Un `TaskBlock` raggruppa task allo stesso livello. Il runtime esegue tutti i task del blocco anche se uno fallisce; solo dopo la fine del blocco, se ci sono errori, i blocchi successivi vengono marcati `DEFERRED` e salvati nella documentazione della run come file Markdown riutilizzabili.

Campi principali:

- `id`
- `title`
- `targetDir`: directory suggerita per reinserire un eventuale `ai-tasks.md`
- `tasks`
