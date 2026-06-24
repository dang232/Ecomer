.PHONY: up down restart rebuild logs logs-all test-order test-payment test-user test-cart test-fe test-e2e test-all test-java build-java compile-order seed migrate psql certs clean status verify-backup help

# ─── Stack Management ─────────────────────────────────────
up: ## Start full stack
	docker compose --profile apps up -d

up-minimal: ## Start gateway + order-service + infra only
	docker compose up -d postgres-order kafka redis keycloak elasticsearch api-gateway order-service

down: ## Stop all containers
	docker compose --profile apps down

restart: ## Restart a specific service (usage: make restart s=order-service)
	docker compose restart $(s)

rebuild: ## Rebuild and restart a service (usage: make rebuild s=order-service)
	docker compose up -d --build $(s)

# ─── Logs ─────────────────────────────────────────────────
logs: ## Tail logs for a service (usage: make logs s=order-service)
	docker compose logs -f --tail=100 $(s)

logs-all: ## Tail all service logs
	docker compose logs -f --tail=50

# ─── Testing ──────────────────────────────────────────────
test-order: ## Run order-service tests
	cd services/order-service && ./mvnw test -q

test-payment: ## Run payment-service tests
	cd services/payment-service && ./mvnw test -q

test-user: ## Run user-service tests in Temurin 25 (Docker) — matches CI exactly
	docker run --rm \
		-v "$(CURDIR):/work" \
		-w /work/services/user-service \
		-v m2-cache:/root/.m2 \
		eclipse-temurin:25-jdk \
		./mvnw -B test "-Dtest=!*ApplicationTests,!ArchitectureRulesTest" -Djacoco.skip=true

test-java: ## Run tests for a Java service in Temurin 25 (Docker) — usage: make test-java s=user-service
	docker run --rm \
		-v "$(CURDIR):/work" \
		-w /work/services/$(s) \
		-v m2-cache:/root/.m2 \
		eclipse-temurin:25-jdk \
		./mvnw -B test "-Dtest=!*ApplicationTests,!ArchitectureRulesTest" -Djacoco.skip=true

test-cart: ## Run cart-service tests
	cd services/cart-service && npm test

test-fe: ## Run frontend tests
	cd fe && npm test

test-e2e: ## Run Playwright E2E tests
	cd fe && npx playwright test

test-all: ## Run all unit tests (Java via Docker Temurin 25, + Node)
	@echo "=== Java services ==="
	$(MAKE) test-java s=order-service
	$(MAKE) test-java s=payment-service
	$(MAKE) test-java s=product-service
	$(MAKE) test-java s=user-service
	@echo "=== Node services ==="
	cd services/cart-service && npm test
	@echo "=== Frontend ==="
	cd fe && npm test

# ─── Build ────────────────────────────────────────────────
build-java: ## Build all Java services (skip tests)
	cd services/order-service && ./mvnw package -DskipTests -q
	cd services/payment-service && ./mvnw package -DskipTests -q
	cd services/product-service && ./mvnw package -DskipTests -q

compile-order: ## Quick compile check for order-service
	cd services/order-service && ./mvnw compile -q

# ─── Database ─────────────────────────────────────────────
seed: ## Run Kafka topic creation script
	docker compose exec kafka bash /opt/scripts/init-kafka-topics.sh

migrate: ## Trigger Flyway migrations (restart services)
	docker compose --profile apps restart

psql: ## Connect to order-service database
	docker compose exec postgres-order psql -U vnshop -d order_svc

# ─── Utilities ────────────────────────────────────────────
certs: ## Generate Kafka SSL certificates
	cd infra/kafka/certs && bash generate-certs.sh

verify-backup: ## Verify database backups by dump/restore and smoke queries
	./scripts/verify-backup.sh

clean: ## Remove all containers and build artifacts (preserves volumes)
	docker compose --profile apps down
	cd services/order-service && ./mvnw clean -q 2>/dev/null || true

status: ## Show running containers and their health
	docker compose ps

# ─── Performance ──────────────────────────────────────────
perf-flash: ## Run k6 flash-sale load test
	k6 run infra/k6/scenarios/flash-sale-load.js

perf-search: ## Run k6 search autocomplete test
	k6 run infra/k6/scenarios/search-autocomplete.js

# ─── Help ─────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
