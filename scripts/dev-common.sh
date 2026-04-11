#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/compose/docker-compose.dev.yml"
APP_PORTS=(3000 4000 4100)
PROCESS_PATTERNS=(
  "tsx watch src/server.ts"
  "tsx watch src/index.ts"
  "next dev --hostname 0.0.0.0"
  "node dist/server.js"
  "node dist/index.js"
  "tsx dist/server.js"
  "tsx dist/index.js"
  "next-server"
)

ensure_env_file() {
  if [[ -f "$ROOT_DIR/.env" ]]; then
    return
  fi

  echo "Missing .env file."
  echo "Create it with:"
  echo "  cp .env.example .env"
  exit 1
}

ensure_dependencies_installed() {
  if [[ -d "$ROOT_DIR/node_modules" ]]; then
    return
  fi

  echo "Dependencies are not installed."
  echo "Run:"
  echo "  pnpm install"
  exit 1
}

clear_port() {
  local port="$1"
  local pids=()
  local pid=""

  while IFS= read -r pid; do
    [[ -n "$pid" ]] && pids+=("$pid")
  done < <(lsof -ti tcp:"$port" 2>/dev/null || true)

  if [[ "${#pids[@]}" -eq 0 ]]; then
    return
  fi

  echo "Clearing port $port (PID: ${pids[*]})..."
  kill "${pids[@]}" 2>/dev/null || true
  sleep 1

  pids=()

  while IFS= read -r pid; do
    [[ -n "$pid" ]] && pids+=("$pid")
  done < <(lsof -ti tcp:"$port" 2>/dev/null || true)

  if [[ "${#pids[@]}" -eq 0 ]]; then
    return
  fi

  echo "Force killing port $port listeners (PID: ${pids[*]})..."
  kill -9 "${pids[@]}" 2>/dev/null || true
}

kill_dev_processes() {
  local pattern
  local pids=()
  local pid=""

  for pattern in "${PROCESS_PATTERNS[@]}"; do
    pids=()

    while IFS= read -r pid; do
      [[ -n "$pid" ]] && pids+=("$pid")
    done < <(pgrep -f "$pattern" 2>/dev/null || true)

    if [[ "${#pids[@]}" -eq 0 ]]; then
      continue
    fi

    echo "Stopping dev processes for pattern '$pattern' (PID: ${pids[*]})..."
    kill "${pids[@]}" 2>/dev/null || true
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

wait_for_service_healthy() {
  local service="$1"
  local attempts=0
  local container_id=""
  local status=""

  while true; do
    container_id="$(docker compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null || true)"

    if [[ -n "$container_id" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"

      if [[ "$status" == "healthy" || "$status" == "running" ]]; then
        return 0
      fi
    fi

    attempts=$((attempts + 1))

    if [[ "$attempts" -ge 30 ]]; then
      echo "Service '$service' did not become ready in time."
      return 1
    fi

    sleep 2
  done
}

start_infra() {
  docker compose -f "$COMPOSE_FILE" up -d postgres redis
  wait_for_service_healthy postgres
  wait_for_service_healthy redis
}

stop_infra() {
  docker compose -f "$COMPOSE_FILE" down "$@"
}
