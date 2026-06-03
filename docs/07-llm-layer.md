# node-droid — LLM Layer

---

## llm-client.service.ts

### Nome
LLMClientService

### Responsabilità
- Comunica con LLM via protocollo OpenAI-compatible
- Supporta modelli commerciali e self-hosted
- Esegue chiamate chat/completion tramite `axios`
- Costruisce URL, payload e header tramite helper dedicati

### Input
- Messaggi chat o prompt singolo
- Tools (opzionali)
- Parametri modello

### Output
- Completion
- Tool calls

### Dipendenze
- axios
- LLMRequests

### Non deve fare
- Non deve decidere il flusso
- Non deve validare task
- Non deve modificare file
- Non deve chiamare Git
- Non deve gestire retry o rate limit finche' non viene aggiunta una policy esplicita

---

## llm-profile-resolver.service.ts

### Nome
LLMProfileResolverService

### Responsabilità
- Risolve quale LLM usare:
  - default ENV
  - override repo.yml

### Input
- RepoContext
- ENV

### Output
- LLMProfile

### Dipendenze
- env.ts
- RepoContextService

### Non deve fare
- Non deve chiamare LLM
- Non deve orchestrare

---

## prompt-template.service.ts

### Nome
PromptTemplateService

### Responsabilità
- Fornisce prompt versionati
- Mantiene template per:
  - task extraction
  - task execution
  - retry
  - summarization

### Input
- Nome template
- Parametri

### Output
- Prompt finale

### Dipendenze
- libs (template utils)

### Non deve fare
- Non deve chiamare LLM
- Non deve leggere file di progetto

---

## prompt.service.ts

### Nome
PromptService

### Responsabilità
- Costruisce i messaggi finali per analisi task, esecuzione task e retry
- Integra template e istruzioni AI

### Input
- Task
- BuildResult in fase di retry

### Output
- Messaggi chat per LLMClientService

### Dipendenze
- PromptTemplateService
- AIInstructionsService

### Non deve fare
- Non deve chiamare LLM
- Non deve eseguire tool

---

## translate-to-english.service.ts

### Nome
TranslateToEnglishService

### Responsabilità
- Normalizza titolo e descrizione dei task in inglese quando necessario

### Input
- Lista Task

### Output
- Lista Task aggiornata

### Non deve fare
- Non deve eseguire task
- Non deve modificare file del repo
