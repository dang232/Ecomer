#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="$(cd "${INFRA_DIR}/.." && pwd)"
COMPOSE_FILE="${INFRA_DIR}/compose/staging/docker-compose.staging.yml"
ACCESS_URL="${ACCESS_URL:-http://localhost:8180}"
HEALTH_URL="${HEALTH_URL:-${ACCESS_URL}/actuator/health}"
SMOKE_URL="${SMOKE_URL:-${ACCESS_URL}/health}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-60}"
SLEEP_SECONDS="${SLEEP_SECONDS:-5}"

cd "${PROJECT_ROOT}"

echo "Starting VNShop local-only developer harness"
docker compose -f "${COMPOSE_FILE}" --profile local-only-dev up -d --build

echo "Waiting for staging gateway health at ${HEALTH_URL}"
for attempt in $(seq 1 "${MAX_ATTEMPTS}"); do
  if curl -fsS "${HEALTH_URL}" >/dev/null; then
    echo "Gateway healthy"
    break
  fi

  if [[ "${attempt}" == "${MAX_ATTEMPTS}" ]]; then
    echo "Gateway did not become healthy after $((MAX_ATTEMPTS * SLEEP_SECONDS)) seconds" >&2
    docker compose -f "${COMPOSE_FILE}" --profile local-only-dev ps
    exit 1
  fi

  sleep "${SLEEP_SECONDS}"
done

echo "Running staging smoke test at ${SMOKE_URL}"
curl -fsS "${SMOKE_URL}" >/dev/null

echo "Local-only developer harness complete"
echo "Access URL: ${ACCESS_URL}"
