#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/compose/docker-compose.yml"
SEED_DB=1
RESET_INFRA=0
PORTS=(3000 4000 4100 5432 6379)
PROCESS_PATTERNS=(
  "tsx watch src/server.ts"
  "tsx watch src/index.ts"
  "next dev --hostname 0.0.0.0 --port 3000"
  "node dist/server.js"
  "node dist/index.js"
  "next-server"
)

for arg in "$@"; do
  case "$arg" in
    --no-seed)
      SEED_DB=0
      ;;
    --reset)
      RESET_INFRA=1
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: pnpm dev:stack [--no-seed] [--reset]"
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "Missing .env file."
  echo "Create it with:"
  echo "  cp .env.example .env"
  exit 1
fi

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

clear_port() {
  local port="$1"
  local pids

  pids="$(lsof -ti tcp:"$port" 2>/dev/null | tr '\n' ' ' | xargs echo 2>/dev/null || true)"

  if [[ -z "${pids// }" ]]; then
    return
  fi

  echo "Clearing port $port (PID: $pids)..."
  kill $pids 2>/dev/null || true
  sleep 1

  local stubborn
  stubborn="$(lsof -ti tcp:"$port" 2>/dev/null | tr '\n' ' ' | xargs echo 2>/dev/null || true)"

  if [[ -n "${stubborn// }" ]]; then
    echo "Force killing port $port listeners (PID: $stubborn)..."
    kill -9 $stubborn 2>/dev/null || true
  fi
}

kill_dev_processes() {
  for pattern in "${PROCESS_PATTERNS[@]}"; do
    local pids
    pids="$(pgrep -f "$pattern" | tr '\n' ' ' | xargs echo 2>/dev/null || true)"

    if [[ -n "${pids// }" ]]; then
      echo "Stopping dev processes for pattern '$pattern' (PID: $pids)..."
      kill $pids 2>/dev/null || true
    fi
  done
}

wait_for_port_clear() {
  local port="$1"
  local attempts=0

  while lsof -ti tcp:"$port" >/dev/null 2>&1; do
    attempts=$((attempts + 1))

    if [[ "$attempts" -ge 20 ]]; then
      echo "Port $port is still busy after waiting."
      return 1
    fi

    sleep 0.25
  done
}

trap cleanup EXIT INT TERM

echo "Installing dependencies..."
pnpm install

if [[ "$RESET_INFRA" -eq 1 ]]; then
  echo "Resetting Docker services and volumes..."
  docker compose -f "$COMPOSE_FILE" down -v
fi

echo "Stopping lingering local dev processes..."
kill_dev_processes

echo "Clearing local dev ports..."
for port in "${PORTS[@]}"; do
  clear_port "$port"
done

for port in 3000 4000 4100; do
  wait_for_port_clear "$port"
done

echo "Starting PostgreSQL and Redis..."
docker compose -f "$COMPOSE_FILE" up -d postgres redis

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

wait
