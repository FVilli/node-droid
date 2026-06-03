# node-droid — Run Flow

Questo documento descrive il flusso completo di una run.

---

## Fase 0 — Idle

- `AppService` esegue il tick schedulato
- Scansiona workspace
- Garantisce un solo ciclo attivo

---

## Fase 1 — Trigger

- `RunOrchestratorService` prepara il contesto repo
- assicura che il repo sia clonato
- legge il delta remoto Git
- fa pull della base branch
- se trova commit con tag `[ai]` prosegue con l'estrazione task

---

## Fase 2 — Task extraction preliminare

- Legge solo i file modificati nel delta remoto
- Considera file `.ts` e file `ai-tasks.md`
- Estrae task con `TaskExtractionService`
- Normalizza e ordina con `TaskNormalizationService`
- Se non trova task, salta la run
- Traduce/normalizza i task con `TranslateToEnglishService`

---

## Fase 3 — Bootstrap

- Genera runId
- Aggiorna `RunStateService`
- Inizializza log
- Crea e checkout branch di run

---

## Fase 4 — Block planning e queue setup

- Raggruppa i task normalizzati in blocchi coerenti
- I task da commenti `.ts` vengono raggruppati per file
- I task da `ai-tasks.md` vengono raggruppati per directory target
- `TaskQueueService.loadBlocks()`
- Logga il piano dei blocchi
- Imposta phase `TASK_EXECUTION`

---

## Fase 5 — Block e task loop

Per ogni blocco:

- Avvia il blocco corrente
- Esegue tutti i task del blocco in ordine
- Se un task fallisce o resta bloccato, completa comunque il blocco corrente
- Dopo un blocco con errori, ferma i blocchi successivi
- Marca i blocchi successivi non eseguiti come `DEFERRED`
- In caso di interruzione della run, marca come `DEFERRED` anche i task non ancora iniziati del blocco corrente
- Scrive i blocchi differiti come Markdown in `.ai/<run>/deferred-task-blocks/`

Per ogni task eseguito:

- `RunStateService` aggiorna task corrente, indice e attempt
- `TaskExecutorService`
- Analisi read-only del task e piano operativo loggato
- Tool loop di esecuzione
- Build
- Retry se necessario
- `TaskQueueService.mark()`
- Outcome possibile: `DONE`, `FAILED`, `BLOCKED`, `DEFERRED` oppure `INTERRUPTED`

---

## Fase 6 — Finalization

- Rimuove `ai-tasks.md` processati
- Sostituisce i marker `[ai]` nei file `.ts` con righe di esito
- Mantiene nella documentazione della run i file Markdown dei blocchi `DEFERRED`
- Commit bot
- Push branch
- `MergeRequestService`
- Finalize log

---

## Fase 7 — Idle

- Attende prossimo trigger
