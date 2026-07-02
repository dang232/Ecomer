#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="$(cd "${INFRA_DIR}/.." && pwd)"
BACKUP_DIR="${INFRA_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
POSTGRES_BACKUP="${BACKUP_DIR}/vnshop-${TIMESTAMP}.sql.gz"
KEYCLOAK_BACKUP="${BACKUP_DIR}/keycloak-${TIMESTAMP}.json"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-vnshop}"
KEYCLOAK_CONTAINER="${KEYCLOAK_CONTAINER:-${COMPOSE_PROJECT_NAME}-keycloak}"

mkdir -p "${BACKUP_DIR}"

cd "${PROJECT_ROOT}"

echo "Creating PostgreSQL backup: ${POSTGRES_BACKUP}"
docker compose exec -T postgres-legacy pg_dump -U vnshop vnshop | gzip > "${POSTGRES_BACKUP}"

echo "Creating Keycloak realm backup: ${KEYCLOAK_BACKUP}"
docker compose exec -T keycloak /opt/keycloak/bin/kc.sh export --realm vnshop --dir /opt/keycloak/data/export
docker cp "${KEYCLOAK_CONTAINER}:/opt/keycloak/data/export/vnshop-realm.json" "${KEYCLOAK_BACKUP}"

echo "Backup complete"
echo "PostgreSQL: ${POSTGRES_BACKUP}"
echo "Keycloak: ${KEYCLOAK_BACKUP}"
