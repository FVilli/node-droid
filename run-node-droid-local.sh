#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_NAME="$(basename "$SOURCE_ROOT")"
SOURCE_PARENT="$(cd "$SOURCE_ROOT/.." && pwd)"
WORKER_WORKSPACE="${WORKER_WORKSPACE:-$SOURCE_PARENT/${SOURCE_NAME}_workspace}"
CORE_DIR="$SOURCE_ROOT/core"
CONFIG_SOURCE="$SOURCE_ROOT/develop-config.yml"
CONFIG_TARGET_DIR="$WORKER_WORKSPACE/node-droid-self"
CONFIG_TARGET="$CONFIG_TARGET_DIR/repo.yml"

if [[ ! -f "$CONFIG_SOURCE" ]]; then
  echo "Missing auto-develop config: $CONFIG_SOURCE" >&2
  exit 1
fi

mkdir -p "$CONFIG_TARGET_DIR"
cp "$CONFIG_SOURCE" "$CONFIG_TARGET"

export WORKSPACE_FOLDER="${WORKSPACE_FOLDER:-$WORKER_WORKSPACE}"
export LLM_API_URL="${LLM_API_URL:-http://localhost:8000/v1}"
export LLM_API_KEY="${LLM_API_KEY:-dummy}"
export LLM_MODEL="${LLM_MODEL:-qwen/qwen3-coder-next}"
export LLM_TEMPERATURE="${LLM_TEMPERATURE:-0.2}"
export LLM_MAX_TOKENS="${LLM_MAX_TOKENS:-262144}"

echo "auto-develop workspace: $WORKSPACE_FOLDER"
echo "auto-develop config: $CONFIG_TARGET"

cd "$CORE_DIR"
exec npm start
