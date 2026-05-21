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

L’LLM deve preferire tool mirati rispetto a riscritture complete:

- usare `ai-context.md` in root e nelle cartelle rilevanti come memoria locale di contesto
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

## CTX Strategy

Il contesto operativo locale viene gestito tramite file `ai-context.md`.

Regole:

- puo' esistere un `ai-context.md` in root
- puo' esistere un `ai-context.md` in cartelle rilevanti del progetto
- il modello deve leggerli prima di espandere troppo il browsing
- il modello puo' fare bootstrap di `ai-context.md` se manca
- il modello puo' fare refresh & compact quando il task modifica conoscenza locale utile
- il task resta prioritario rispetto alla manutenzione degli `ai-context.md`

Template ufficiale:

```md
# AI Context

## Purpose
Breve descrizione della responsabilita' della cartella o del modulo.

## Key Files
- `file-a.ts`: ruolo essenziale
- `file-b.ts`: ruolo essenziale

## Local Rules
- Convenzioni locali da rispettare in questa cartella.

## Patterns
- Pattern architetturali o strutturali ricorrenti.

## Dependencies
- Dipendenze locali o integrazioni importanti per questa cartella.

## Gotchas
- Trappole, file generati, punti fragili o errori facili.

## Open Notes
- Note locali utili ma non ancora del tutto consolidate.
```

Vincoli:

- deve restare corto e operativo
- le sezioni irrilevanti vanno omesse
- target indicativo: 200-300 parole
- non deve diventare storico dei task o documentazione completa del modulo
