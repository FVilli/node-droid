# node-droid — Run Flow

Questo documento descrive il flusso completo di una run.

---

## Fase 0 — Idle

- AppService entra in loop
- Attende WATCH_INTERVAL
- Scansiona workspace

---

## Fase 1 — Trigger

- git pull
- se nuovo commit con prefisso [ai] → start run

---

## Fase 2 — Bootstrap

- Genera runId
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
- Normalizzazione
- Queue setup

---

## Fase 5 — Task loop

Per ogni task:

- Mark IN_PROGRESS
- TaskExecutorService
- Tool loop
- Build
- Retry se necessario
- Mark DONE / FAILED

---

## Fase 6 — Finalization

- Commit bot
- Push branch
- Create MR
- Finalize log

---

## Fase 7 — Idle

- Attende prossimo trigger
