# node-droid — LLM Layer

---

## llm-client.service.ts

### Nome
LLMClientService

### Responsabilità
- Comunica con LLM via protocollo OpenAI-compatible
- Supporta modelli commerciali e self-hosted
- Gestisce:
  - timeout
  - retry
  - logging
  - rate limit

### Input
- Prompt
- Tools (opzionali)
- Parametri modello

### Output
- Completion
- Tool calls

### Dipendenze
- fetch / axios / openai sdk

### Non deve fare
- Non deve decidere il flusso
- Non deve validare task
- Non deve modificare file
- Non deve chiamare Git

---

## llm-profile-resolver.service.ts

### Nome
LLMProfileResolverService

### Responsabilità
- Risolve quale LLM usare:
  - default ENV
  - override repo.json

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
