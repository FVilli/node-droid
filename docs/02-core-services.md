# node-droid — Core Services

## app.service.ts

### Nome
AppService (NodeDroid Orchestrator)

### Responsabilità
- È il cervello del sistema
- Gestisce il loop principale
- Garantisce sequenzialità globale
- Avvia e termina i run
- Coordina tutti i servizi
- Gestisce errori globali
- Decide quando creare branch, quando fermarsi, quando creare MR

### Input
- WorkspaceService
- RepoContextService
- GitService
- TaskExtractionService
- TaskNormalizationService
- TaskQueueService
- TaskExecutorService
- RunLoggerService
- MergeRequestService
- RunStateService

### Output
- Run completi
- Branch creati
- Commit bot
- Merge Request
- Log Markdown

### Dipendenze
- Tutti gli altri servizi

### Non deve fare
- Non deve parlare direttamente con LLM
- Non deve fare parsing file
- Non deve eseguire comandi shell
- Non deve toccare il filesystem
- Non deve gestire Git direttamente

---

## run-state.service.ts

### Nome
RunStateService

### Responsabilità
- Mantiene lo stato runtime
- Tiene traccia di:
  - runId
  - repo attivo
  - branch attivo
  - task corrente
  - attempt corrente
  - policy attive
- Espone snapshot dello stato

### Input
- Eventi da app.service.ts

### Output
- Stato aggiornato
- Snapshot

### Dipendenze
- Nessuna (stato puro)

### Non deve fare
- Non deve eseguire logica
- Non deve chiamare altri servizi
- Non deve scrivere file
