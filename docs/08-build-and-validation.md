# node-droid — Build & Validation

---

## build.service.ts

### Nome
BuildService

### Responsabilità
- Esegue il comando di build configurato
- Normalizza output
- Identifica errori
- Classifica errori (syntax, types, missing imports, ecc.)

### Input
- RepoContext

### Output
- BuildResult:
  - success
  - stdout
  - stderr
  - exitCode

### Dipendenze
- child_process / execa

### Non deve fare
- Non deve chiamare LLM
- Non deve applicare patch
- Non deve orchestrare
