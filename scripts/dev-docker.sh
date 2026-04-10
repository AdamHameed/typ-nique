#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./dev-common.sh
source "$SCRIPT_DIR/dev-common.sh"

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-typnique}"
APP_IMAGES=(
  "${COMPOSE_PROJECT_NAME}-api"
  "${COMPOSE_PROJECT_NAME}-web"
  "${COMPOSE_PROJECT_NAME}-worker"
)

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      echo "Usage:"
      echo "  pnpm dev:docker"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage:"
      echo "  pnpm dev:docker"
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"
ensure_env_file

echo "Stopping lingering local dev processes..."
kill_dev_processes

echo "Clearing local dev ports..."
for port in "${APP_PORTS[@]}"; do
  clear_port "$port"
done

for port in "${APP_PORTS[@]}"; do
  wait_for_port_clear "$port"
done

echo "Stopping Docker stack and deleting volumes..."
docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" down -v --remove-orphans 2>/dev/null || true

echo "Removing app images..."
for image in "${APP_IMAGES[@]}"; do
  docker image rm "$image" 2>/dev/null || true
done

echo "Rebuilding Docker images from scratch..."
docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" build --no-cache

echo "Starting Docker stack..."
docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up -d

echo "Waiting for services..."
wait_for_service_healthy postgres
wait_for_service_healthy redis
wait_for_service_healthy api
wait_for_service_healthy worker
wait_for_service_healthy web

echo
echo "Typ-Nique is running in Docker."
echo "  Web:    http://localhost:3000"
echo "  API:    http://localhost:4000/health"
echo "  Worker: http://localhost:4100/health"
echo
echo "Project name: $COMPOSE_PROJECT_NAME"
