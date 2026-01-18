# node-droid — Task Execution & Tool Emulation

---

## task-executor.service.ts

### Nome
TaskExecutorService

### Responsabilità
- Esegue un singolo task alla volta
- Gestisce il loop di esecuzione con LLM
- Fornisce tool virtuali all’LLM
- Gestisce retry su errore
- Esegue il gate di validazione (build)
- Determina l’outcome del task (DONE / FAILED)

### Input
- Task
- RepoContext
- RunState

### Output
- TaskOutcome (DONE / FAILED)
- Patch applicate
- Log degli step

### Dipendenze
- LLMClientService
- ToolRegistryService
- BuildService
- RunLoggerService
- RunStateService

### Non deve fare
- Non deve decidere l’ordine dei task
- Non deve creare branch
- Non deve fare commit
- Non deve creare merge request

---

## tool-registry.service.ts

### Nome
ToolRegistryService

### Responsabilità
- Espone all’LLM l’elenco dei tool disponibili
- Valida le richieste di tool
- Instrada la richiesta al servizio corretto
- Normalizza output

### Input
- ToolCall (nome + argomenti)

### Output
- ToolResult

### Dipendenze
- FileSystemToolService

### Non deve fare
- Non deve parlare con LLM
- Non deve scrivere file direttamente
- Non deve gestire stato

---

## filesystem-tool.service.ts

### Nome
FileSystemToolService

### Responsabilità
- Implementa tool reali sul filesystem:
  - list
  - read
  - apply_patch
  - create
  - delete
- Enforce sandbox
- Valida path
- Garantisce che non si esca dal workspace

### Input
- Path
- Payload (patch, contenuto, ecc.)

### Output
- Risultato normalizzato

### Dipendenze
- fs
- path
- RepoContextService

### Non deve fare
- Non deve parlare con LLM
- Non deve fare Git
- Non deve orchestrare
