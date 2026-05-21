# node-droid - Tool Contract

Questo documento descrive i tool esposti all'LLM durante l'esecuzione task.

---

## Principi

- I tool operano solo dentro il repo clonato (`RepoContext.codePath`).
- I path sono relativi alla root del repo clonato.
- `FileSystemPaths.resolve` blocca path escape fuori dalla sandbox.
- Preferire tool mirati a riscritture complete.
- `save_file` e' un fallback, non il percorso normale per modifiche locali.

---

## Tool disponibili

### list_files

Lista file e cartelle in una directory.

Input:

```json
{ "path": "." }
```

Output:

```json
{ "success": true, "output": ["src", "package.json"] }
```

### get_folder_content

Alias legacy di `list_files`.

### read_file

Legge un file testuale intero.

Input:

```json
{ "path": "src/main.ts" }
```

### read_file_range

Legge un range di righe.

Input:

```json
{ "path": "src/main.ts", "startLine": 1, "endLine": 40 }
```

Output:

```json
{
  "success": true,
  "output": {
    "path": "src/main.ts",
    "startLine": 1,
    "endLine": 40,
    "content": "..."
  }
}
```

### search

Cerca testo dentro i file sotto una directory.

Input:

```json
{
  "query": "RunOrchestratorService",
  "path": ".",
  "caseSensitive": false,
  "maxResults": 50
}
```

Ignora directory come `.git`, `node_modules`, `dist`, `.ai`.

### search_file

Cerca file per sottostringa nel nome.

Input:

```json
{
  "query": "orchestrator",
  "path": ".",
  "caseSensitive": false,
  "maxResults": 50
}
```

### create_file

Crea un nuovo file. Fallisce se il file esiste.

Input:

```json
{
  "path": "src/new-file.ts",
  "content": "export {};\n"
}
```

### replace_in_file

Sostituisce testo esistente in un file.

Input:

```json
{
  "path": "src/main.ts",
  "search": "old text",
  "replace": "new text",
  "all": false
}
```

### insert_in_file

Inserisce testo prima o dopo un anchor.

Input:

```json
{
  "path": "src/main.ts",
  "after": "bootstrap();",
  "content": "\nconsole.log('ready');"
}
```

Usare esattamente uno tra `after` e `before`.

### save_file

Scrive un file intero. Usare solo quando `replace_in_file`, `insert_in_file` o `create_file` non sono adatti.

Input:

```json
{
  "path": "src/main.ts",
  "content": "..."
}
```

---

## Errori

Ogni tool ritorna:

```json
{
  "success": false,
  "error": "messaggio"
}
```

Esempi:

- path non leggibile
- anchor non trovato
- search text non trovato
- file gia' esistente
- path escape fuori repo

---

## Logging

`RunLoggerService` registra ogni tool call, conta le chiamate e traccia i file toccati per i tool di scrittura:

- `create_file`
- `replace_in_file`
- `insert_in_file`
- `save_file`
