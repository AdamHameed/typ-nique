#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/compose/docker-compose.yml"
PORTS=(3000 4000 4100 5432 6379)
PROCESS_PATTERNS=(
  "tsx watch src/server.ts"
  "tsx watch src/index.ts"
  "next dev --hostname 0.0.0.0 --port 3000"
  "node dist/server.js"
  "node dist/index.js"
  "next-server"
)

cd "$ROOT_DIR"

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

echo "Stopping Docker services and removing volumes..."
docker compose -f "$COMPOSE_FILE" down -v

echo "Stopping lingering local dev processes..."
kill_dev_processes

echo "Clearing local dev ports..."
for port in "${PORTS[@]}"; do
  clear_port "$port"
done

for port in "${PORTS[@]}"; do
  wait_for_port_clear "$port"
done
