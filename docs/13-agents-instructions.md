# node-droid - AGENTS.md Instructions

Questo documento descrive il file di istruzioni che entra nei prompt task.

---

## File supportato

### AGENTS.md

Contiene direttive operative per l'LLM: regole del progetto, vincoli, preferenze di stile, convenzioni locali e note utili per lavorare nel repository.

Posizioni lette:

- root del repo clonato
- cartella del file che ha generato il task

Le istruzioni root sono etichettate come globali. Le istruzioni locali sono incluse solo quando il task ha un file associato in una sottocartella.

---

## Regole operative

- `AGENTS.md` e' la fonte unica per istruzioni e contesto operativo destinato agli agenti.
- Non usare file paralleli di contesto o istruzioni.
- Non trasformare `AGENTS.md` in cronologia task o report di esecuzione.
- Tenere le istruzioni brevi, riusabili e orientate al comportamento.

Esempio:

```md
# AGENTS.md

## Project Rules
- Use pnpm, not npm.
- Prefer zod for schema validation.
- Keep changes minimal and focused.

## Local Patterns
- Services own orchestration.
- Helpers should stay deterministic and side-effect light.
```

---

## Servizi coinvolti

- `AIInstructionsService`: legge e aggrega `AGENTS.md`.
- `PromptService`: integra istruzioni e template nei messaggi finali.
