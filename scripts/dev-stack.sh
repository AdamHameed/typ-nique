#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./dev-common.sh
source "$SCRIPT_DIR/dev-common.sh"

SEED_DB=1
RESET_INFRA=0

for arg in "$@"; do
  case "$arg" in
    --no-seed)
      SEED_DB=0
      ;;
    --reset)
      RESET_INFRA=1
      ;;
    --help|-h)
      echo "Usage:"
      echo "  pnpm dev"
      echo "  pnpm dev:no-seed"
      echo "  pnpm dev:reset"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage:"
      echo "  pnpm dev"
      echo "  pnpm dev:no-seed"
      echo "  pnpm dev:reset"
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"
ensure_env_file
ensure_dependencies_installed

cleanup() {
  local exit_code=$?

  if [[ -n "${API_PID:-}" ]]; then
    kill "$API_PID" 2>/dev/null || true
  fi

  if [[ -n "${WORKER_PID:-}" ]]; then
    kill "$WORKER_PID" 2>/dev/null || true
  fi

  if [[ -n "${WEB_PID:-}" ]]; then
    kill "$WEB_PID" 2>/dev/null || true
  fi

  wait 2>/dev/null || true
  exit "$exit_code"
}

trap cleanup EXIT INT TERM

if [[ "$RESET_INFRA" -eq 1 ]]; then
  echo "Resetting Docker services and volumes..."
  stop_infra -v
fi

echo "Stopping lingering local dev processes..."
kill_dev_processes

echo "Clearing local dev ports..."
for port in "${APP_PORTS[@]}"; do
  clear_port "$port"
done

for port in "${APP_PORTS[@]}"; do
  wait_for_port_clear "$port"
done

echo "Starting PostgreSQL and Redis..."
start_infra

echo "Generating Prisma client..."
pnpm db:generate

echo "Applying database migrations..."
pnpm db:migrate

if [[ "$SEED_DB" -eq 1 ]]; then
  echo "Seeding database..."
  pnpm db:seed
fi

echo "Starting API on http://localhost:4000 ..."
pnpm --filter @typ-nique/api dev &
API_PID=$!

echo "Starting worker on http://localhost:4100 ..."
pnpm --filter @typ-nique/worker dev &
WORKER_PID=$!

echo "Starting web app on http://localhost:3000 ..."
pnpm --filter @typ-nique/web dev &
WEB_PID=$!

echo
echo "Typ-Nique is booting."
echo "  Web:    http://localhost:3000"
echo "  API:    http://localhost:4000/health"
echo "  Worker: http://localhost:4100/health"
echo
echo "Press Ctrl+C to stop the local app processes."
echo "Run 'pnpm stop' later to shut down Docker services too."

wait
