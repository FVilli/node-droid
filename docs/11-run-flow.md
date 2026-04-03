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
- legge il delta remoto Git
- se trova commit con tag `[ai]` avvia la run

---

## Fase 2 — Bootstrap

- Genera runId
- Aggiorna `RunStateService`
- Crea branch
- Checkout branch
- Inizializza log

---

## Fase 3 — Context extraction

- Diff
- Lista file
- Commit message
- Snapshot

---

## Fase 4 — Task extraction

- Per ogni file rilevante:
  - TaskExtractionService
- `TaskNormalizationService`
- `TaskQueueService.load()`

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

- Commit bot
- Push branch
- `MergeRequestService`
- Finalize log

---

## Fase 7 — Idle

- Attende prossimo trigger
