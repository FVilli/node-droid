# node-droid — Core Services

## app.service.ts

### Nome
AppService (Scheduler / Workspace Scanner)

### Responsabilità
- Esegue il tick schedulato
- Scansiona la workspace
- Garantisce che ci sia un solo ciclo attivo
- Gestisce shutdown e fatal error di alto livello
- Delega la run al servizio orchestratore
- Gestisce errori globali

### Input
- WorkspaceService
- RunLoggerService
- RunOrchestratorService
- RunStateService

### Output
- Tick eseguiti
- Dispatch delle run sui repo

### Dipendenze
- Solo servizi di scheduling e coordinamento alto livello

### Non deve fare
- Non deve parlare direttamente con LLM
- Non deve fare parsing file
- Non deve eseguire comandi shell
- Non deve toccare il filesystem
- Non deve gestire Git direttamente

---

## run-orchestrator.service.ts

### Nome
RunOrchestratorService

### Responsabilità
- Coordina il flusso completo di una run
- Prepara il contesto repo
- Esegue task extraction, normalizzazione e queue setup
- Avvia bootstrap, task loop e finalizzazione
- Coordina commit, push, merge request e cleanup dei marker task

### Input
- RepoContextService
- GitService
- TaskExtractionService
- TaskNormalizationService
- TaskQueueService
- TaskExecutorService
- MergeRequestService
- RunLoggerService
- RunStateService
- TranslateToEnglishService

### Output
- Run completi
- Branch creati
- Commit bot
- Merge Request
- Log Markdown

### Dipendenze
- Tutti i servizi di run

### Non deve fare
- Non deve parlare direttamente con l’LLM
- Non deve implementare logica di tool calling
- Non deve costruire prompt
- Non deve sostituire i servizi Git / task / logging dedicati

---

## run-state.service.ts

### Nome
RunStateService

### Responsabilità
- Mantiene lo snapshot runtime della run
- Tiene traccia di:
  - runId
  - repo attivo
  - branch attivo
  - task corrente
  - indice task corrente
  - attempt corrente
- phase corrente
- status corrente
- stato di shutdown
- Espone snapshot dello stato

### Input
- Eventi da AppService, RunOrchestratorService e TaskExecutorService

### Output
- Stato aggiornato
- Snapshot

### Dipendenze
- Nessuna (stato puro)

### Non deve fare
- Non deve eseguire logica
- Non deve chiamare altri servizi
- Non deve scrivere file
