# node-droid - Deployment & Docker

Questo documento descrive l'esecuzione containerizzata.

---

## Dockerfile

Il Dockerfile principale e' `core/Dockerfile`.

Struttura attuale:

- stage `build` basato su Node slim
- install dipendenze con `npm ci`
- build NestJS con `npm run build`
- stage `runtime`
- install dipendenze production con `npm ci --omit=dev`
- avvio con `node dist/main`

Il container esegue il runtime compilato, non `nest start`.

---

## Docker Compose

Il compose root e' `docker-compose.yml`.

Servizio:

- `node-droid`

Comportamento:

- build locale usando `core/Dockerfile`
- restart `unless-stopped`
- rete dedicata `node-droid-network`
- mount SSH read-only da host

Attenzione: verificare sempre la coerenza tra `WORKSPACE_FOLDER` e il volume montato. Il default Docker in `env.ts` e' `/app/workspace`, mentre il compose puo' montare workspace su path diversi.

---

## Volumi necessari

### Workspace

La workspace deve contenere una cartella per repo con `repo.yml`.

Esempio:

```text
workspace/
  my-service/
    repo.yml
    code/
```

Mount consigliato:

```yaml
volumes:
  - ./workspace:/app/workspace
```

### SSH

Per cloni/push via SSH:

```yaml
volumes:
  - ~/.ssh:/root/.ssh:ro
```

Assicurarsi che known hosts e chiavi siano disponibili nel container.

---

## GitHub CLI

La creazione PR passa da `gh pr create` tramite `GitCommands.createPr`.

Requisiti operativi:

- `gh` disponibile nell'immagine runtime
- autenticazione valida tramite token o configurazione CLI
- remote GitHub

Se `gh` non e' installato o autenticato, la finalizzazione PR fallisce.

---

## Configurazione runtime

Passare le variabili env del runtime nel compose o nel sistema di deploy:

```yaml
environment:
  WORKSPACE_FOLDER: /app/workspace
  LLM_API_URL: http://host.docker.internal:8000/v1
  LLM_API_KEY: dummy
  LLM_MODEL: qwen/qwen3-coder-next
  MQTT_AUDIT_ENABLED: "true"
  MQTT_AUDIT_URL: mqtt://host.docker.internal:1883
```

Vedi `docs/12-configuration.md` per la lista completa.

---

## Checklist di deploy

- Workspace montata sullo stesso path configurato in `WORKSPACE_FOLDER`.
- Ogni repo ha un `repo.yml`.
- SSH configurato se il remote e' SSH.
- `gh` installato/autenticato se si vogliono PR.
- Endpoint LLM raggiungibile dal container.
- MQTT raggiungibile se audit MQTT e' abilitato.
- `DRY_RUN=true` usato per prove senza push/PR/LLM.
