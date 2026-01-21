#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "git not found" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node not found" >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "not a git repository" >&2
  exit 1
fi

if [ ! -f "package.json" ] || [ ! -f "src/env.ts" ]; then
  echo "run this script from the core/ directory" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "working tree is dirty; commit or stash changes first" >&2
  exit 1
fi

version=$(node -p "require('./package.json').version")

current_revision=$(grep -E '^const revision = ' src/env.ts | sed -E 's/[^0-9]*([0-9]+).*/\1/')
if [ -z "$current_revision" ]; then
  echo "could not read revision from src/env.ts" >&2
  exit 1
fi

new_revision=$((current_revision + 1))

sed -E -i "s/^const revision = [0-9]+;/const revision = ${new_revision};/" src/env.ts

tag="v${version}.${new_revision}"

if [ -n "$(git status --porcelain src/env.ts)" ]; then
  git add src/env.ts
  git commit -m "[core] ${tag}"
  git push
else
  echo "no changes in src/env.ts; nothing to commit" >&2
  exit 1
fi
