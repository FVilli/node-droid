# node-droid — Task Execution & Tool Emulation

---

## task-executor.service.ts

### Nome
TaskExecutorService

### Responsabilità
- Esegue un singolo task alla volta
- Gestisce una fase di analisi read-only prima dell'esecuzione
- Registra un piano operativo osservabile per il task
- Gestisce il loop di esecuzione con LLM
- Fornisce tool virtuali all’LLM
- Gestisce retry su errore
- Esegue il gate di validazione (build)
- Determina l’outcome del task (`DONE` / `FAILED` / `BLOCKED` / `INTERRUPTED`)
- Se possibile limita install/build ai package che contengono file modificati

### Input
- Task
- RepoContext
- RunState

### Output
- TaskOutcome (`DONE` / `FAILED` / `BLOCKED` / `INTERRUPTED`)
- Patch applicate
- Log degli step

### Dipendenze
- LLMClientService
- ToolRegistryService
- BuildService
- RunLoggerService
- RunStateService
- PromptService
- LLMProfileResolverService
- RepoContextService

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
  - `list_files`
  - `get_folder_content` (legacy alias)
  - `read_file`
  - `read_file_range`
  - `search`
  - `search_file`
  - `create_file`
  - `replace_in_file`
  - `insert_in_file`
  - `save_file` (fallback)
- Enforce sandbox
- Valida path
- Garantisce che non si esca dal workspace

### Input
- Path
- Payload (contenuto, search/replace, anchor, ecc.)

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

---

## Tool Policy

Durante l'analisi sono disponibili solo tool di lettura (`list_files`, `search`, `read_file`, `read_file_range` e alias compatibili). Durante l esecuzione l'LLM deve preferire tool mirati rispetto a riscritture complete:

- usare `list_files` per esplorare
- usare `read_file_range` per letture focalizzate dopo `search`
- usare `replace_in_file` e `insert_in_file` per modifiche locali
- usare `create_file` solo per file nuovi
- usare `save_file` solo come fallback

---

## Dependency Policy

L’LLM non deve installare dipendenze direttamente tramite tool.

Se il task richiede una libreria o un pacchetto npm non presente:

- il task puo' terminare come `BLOCKED`
- il modello deve indicare quale pacchetto consiglia di aggiungere
- il modello deve spiegare in breve perche' e' necessario

Nota: il sistema puo' eseguire comandi di install configurati durante la validazione build; questo non autorizza l'LLM ad aggiungere dipendenze arbitrarie.

---
