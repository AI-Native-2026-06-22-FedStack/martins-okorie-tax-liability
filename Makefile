export AWS_ENDPOINT_URL ?= http://localhost:4566
export AWS_DEFAULT_REGION ?= us-east-1
export AWS_ACCESS_KEY_ID ?= test
export AWS_SECRET_ACCESS_KEY ?= test

.PHONY: up down seed test

up:
	docker compose up -d postgres redis floci compute
	$(MAKE) seed
	docker compose up -d api

down:
	docker compose --profile brownfield down -v

seed:
	./scripts/seed.sh

test:
	AWS_ENDPOINT_URL=$(AWS_ENDPOINT_URL) DDB_ENDPOINT=$(AWS_ENDPOINT_URL) AWS_ACCESS_KEY_ID=$(AWS_ACCESS_KEY_ID) AWS_SECRET_ACCESS_KEY=$(AWS_SECRET_ACCESS_KEY) npx vitest run apps/api/test --no-file-parallelism
	npm run test --workspace=web
	AWS_ENDPOINT_URL=$(AWS_ENDPOINT_URL) TAXPULSE_TEST_DATABASE_URL=postgresql://taxpulse_app@localhost:55433/taxpulse_l uv run --locked pytest
