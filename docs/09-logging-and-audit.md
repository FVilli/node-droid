# node-droid — Logging & Audit

---

## run-logger.service.ts

### Nome
RunLoggerService

### Responsabilità
- Crea il summary markdown della run
- Scrive sezioni
- Appende eventi
- Pubblica eventi audit strutturati tramite `AuditPublisherService`
- Finalizza il log

### Input
- Eventi
- Snapshot
- Output servizi

### Output
- File markdown
- Eventi audit

### Dipendenze
- fs
- path
- RepoContextService
- AuditPublisherService

### Non deve fare
- Non deve orchestrare
- Non deve chiamare LLM
- Non deve eseguire task

---

## audit-publisher.service.ts

### Nome
AuditPublisherService

### Responsabilità
- Pubblica eventi audit via MQTT
- Arricchisce gli eventi con snapshot di run
- Gestisce connessione e publish MQTT

### Input
- Tipo evento audit
- Payload evento
- Snapshot da RunStateService

### Output
- Messaggi MQTT JSON

### Dipendenze
- mqtt
- RunStateService

### Non deve fare
- Non deve orchestrare
- Non deve chiamare LLM
- Non deve formattare report markdown

---

## MQTT Contract

Gli eventi audit vengono pubblicati su topic MQTT costruiti così:

```text
<MQTT_AUDIT_TOPIC_PREFIX>/<repoId>/<runId>/<eventType>
```

Esempio:

```text
node-droid/audit/mqtt-archiver/ab12cd34ef56/task.build
```

### Event Types

- `run.event`
- `run.status`
- `task.status`
- `task.attempt`
- `task.context`
- `task.build`
- `task.tool`
- `task.llm`

### Common Envelope

Tutti i messaggi pubblicano un JSON con questa struttura base:

```json
{
  "type": "task.build",
  "ts": 1775172000000,
  "app": "core",
  "version": "0.0.8",
  "repoId": "mqtt-archiver",
  "runId": "ab12cd34ef56",
  "branch": "ai/ab12cd34ef56",
  "topic": "node-droid/audit/mqtt-archiver/ab12cd34ef56/task.build",
  "snapshot": {
    "phase": "TASK_EXECUTION",
    "status": "RUNNING",
    "shuttingDown": false,
    "context": {
      "runId": "ab12cd34ef56",
      "repoId": "mqtt-archiver",
      "branchName": "ai/ab12cd34ef56",
      "triggerCommit": {
        "message": "fix mqtt reconnect"
      },
      "startedAt": "2026-04-03T08:00:00.000Z"
    },
    "currentTask": {
      "id": "3f29a2d9f7c1",
      "title": "Handle reconnect after broker drop",
      "index": 1,
      "status": "TODO"
    },
    "attempt": 1
  },
  "payload": {}
}
```

### Payload By Event Type

`run.status`
```json
{
  "status": "COMPLETED",
  "reason": "optional"
}
```

`task.status`
```json
{
  "index": 1,
  "title": "Handle reconnect after broker drop",
  "status": "DONE"
}
```

`task.attempt`
```json
{
  "taskId": "3f29a2d9f7c1",
  "title": "Handle reconnect after broker drop",
  "attempt": 1,
  "phase": "initial"
}
```

`task.build`
```json
{
  "taskId": "3f29a2d9f7c1",
  "title": "Handle reconnect after broker drop",
  "phase": "retry",
  "success": true,
  "exitCode": 0,
  "durationMs": 1240
}
```

`task.context`
```json
{
  "taskId": "3f29a2d9f7c1",
  "title": "Handle reconnect after broker drop",
  "phase": "execution",
  "targetDir": "src/mqtt",
  "hasRootContext": true,
  "hasTargetContext": false,
  "shouldBootstrap": true,
  "allowRefresh": true
}
```

`task.tool`
```json
{
  "taskId": "3f29a2d9f7c1",
  "title": "Handle reconnect after broker drop",
  "name": "read_file",
  "args": {
    "path": "src/mqtt/client.ts"
  },
  "success": true,
  "durationMs": 18
}
```

`task.llm`
```json
{
  "taskId": "3f29a2d9f7c1",
  "title": "Handle reconnect after broker drop",
  "durationMs": 932,
  "usage": {
    "prompt_tokens": 1200,
    "completion_tokens": 320,
    "total_tokens": 1520
  },
  "toolCalls": 2
}
```

### Notes

- `snapshot` rappresenta lo stato runtime al momento della publish.
- `payload` cambia in base al tipo evento.
- `repoId` e `runId` possono essere assenti solo prima dell’avvio completo di una run.
