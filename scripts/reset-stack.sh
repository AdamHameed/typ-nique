#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./dev-common.sh
source "$SCRIPT_DIR/dev-common.sh"

REMOVE_VOLUMES=0

for arg in "$@"; do
  case "$arg" in
    --volumes)
      REMOVE_VOLUMES=1
      ;;
    --help|-h)
      echo "Usage:"
      echo "  pnpm stop"
      echo "  pnpm stop:reset"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage:"
      echo "  pnpm stop"
      echo "  pnpm stop:reset"
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

echo "Stopping lingering local dev processes..."
kill_dev_processes

echo "Clearing local dev ports..."
for port in "${APP_PORTS[@]}"; do
  clear_port "$port"
done

for port in "${APP_PORTS[@]}"; do
  wait_for_port_clear "$port"
done

if [[ "$REMOVE_VOLUMES" -eq 1 ]]; then
  echo "Stopping Docker services and removing volumes..."
  stop_infra -v
else
  echo "Stopping Docker services..."
  stop_infra
fi
