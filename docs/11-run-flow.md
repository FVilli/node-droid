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

## Fase 4 — Queue setup

- `TaskQueueService.load()`
- Imposta phase `TASK_EXECUTION`

---

## Fase 5 — Task loop

Per ogni task:

- `RunStateService` aggiorna task corrente, indice e attempt
- `TaskExecutorService`
- Tool loop
- Build
- Retry se necessario
- `TaskQueueService.mark()`
- Outcome possibile: `DONE`, `FAILED`, `BLOCKED` oppure `INTERRUPTED`

---

## Fase 6 — Finalization

- Rimuove `ai-tasks.md` processati
- Sostituisce i marker `ai:` nei file `.ts` con righe di esito
- Commit bot
- Push branch
- `MergeRequestService`
- Finalize log

---

## Fase 7 — Idle

- Attende prossimo trigger
