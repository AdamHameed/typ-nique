SHELL := /bin/bash
.ONESHELL:
.DEFAULT_GOAL := help

COMPOSE := docker compose -f infra/compose/docker-compose.yml
PNPM := pnpm

.PHONY: help install infra-up infra-down infra-reset db-generate db-migrate db-seed setup dev dev-no-seed reset

help:
	@printf "\nTyp-Nique dev commands\n\n"
	@printf "  make setup       Install deps, start postgres/redis, migrate, and seed\n"
	@printf "  make dev         One-command local startup for web, api, worker, postgres, and redis\n"
	@printf "  make dev-no-seed Same as dev, but skip reseeding\n"
	@printf "  make infra-up    Start postgres and redis only\n"
	@printf "  make infra-down  Stop docker services\n"
	@printf "  make infra-reset Stop docker services and remove volumes\n"
	@printf "  make reset       Full reset: infra-reset, setup\n\n"

install:
	$(PNPM) install

infra-up:
	$(COMPOSE) up -d postgres redis

infra-down:
	$(COMPOSE) down

infra-reset:
	$(COMPOSE) down -v

db-generate:
	$(PNPM) db:generate

db-migrate:
	$(PNPM) db:migrate

db-seed:
	$(PNPM) db:seed

setup: install infra-up db-generate db-migrate db-seed

dev:
	$(PNPM) dev:stack

dev-no-seed:
	$(PNPM) dev:stack:no-seed

reset:
	$(PNPM) dev:stop
	$(MAKE) setup
