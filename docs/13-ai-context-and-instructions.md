# node-droid - AI Context & Instructions

Questo documento descrive i file di contesto e istruzioni che entrano nei prompt task.

---

## File supportati

### ai-instructions.md

Contiene direttive operative per l'LLM.

Posizioni lette:

- root del repo clonato
- cartella del file che ha generato il task

Le istruzioni root sono etichettate come globali. Le istruzioni locali sono incluse solo quando il task ha un file associato in una sottocartella.

### ai-context.md

Contiene memoria locale breve e operativa.

Posizioni lette:

- root del repo clonato
- ogni cartella lungo il percorso del file task

Esempio: per `src/modules/user/service.ts`, il sistema puo' leggere:

```text
ai-context.md
src/ai-context.md
src/modules/ai-context.md
src/modules/user/ai-context.md
```

---

## Context Policy

`ContextFileService` restituisce un bundle di contesto e una policy:

- `targetDir`: cartella associata al task.
- `hasRootContext`: esiste un contesto root.
- `hasTargetContext`: esiste un contesto nella cartella target.
- `shouldBootstrap`: manca il contesto piu' vicino utile.
- `allowRefresh`: il modello puo' creare o aggiornare contesto se utile.

Questa policy viene anche pubblicata come audit event `task.context`.

---

## Regole operative

- Il task resta prioritario: aggiornare contesto non deve sostituire il lavoro richiesto.
- `ai-context.md` deve restare corto, locale e riusabile.
- Non trasformare `ai-context.md` in cronologia task o documentazione estesa.
- `ai-instructions.md` contiene regole, vincoli e preferenze. Non usarlo per note temporanee.

Template consigliato per `ai-context.md`:

```md
# AI Context

## Purpose
Breve responsabilita' della cartella o del modulo.

## Key Files
- `file-a.ts`: ruolo essenziale

## Local Rules
- Convenzioni locali da rispettare.

## Patterns
- Pattern ricorrenti.

## Dependencies
- Integrazioni locali importanti.

## Gotchas
- Punti fragili o errori facili.

## Open Notes
- Note utili ma non ancora consolidate.
```

Target indicativo: 200-300 parole, omettendo sezioni irrilevanti.

---

## Servizi coinvolti

- `AIInstructionsService`: legge e aggrega `ai-instructions.md`.
- `ContextFileService`: legge e aggrega `ai-context.md`, producendo la policy.
- `PromptService`: integra istruzioni, contesto e template nei messaggi finali.
- `RunLoggerService`: registra e pubblica gli eventi di context policy.
