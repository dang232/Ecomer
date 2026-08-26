#!/usr/bin/env bash
set -euo pipefail

service="${1:?usage: $0 <service-directory> [log-file]}"
log_file="${2:-${service##*/}-coverage.log}"

if [[ "$service" != "product-service" ]]; then
  echo "coverage is configured only for product-service" >&2
  exit 2
fi

cd "$(dirname "$0")/../.."

mvn --batch-mode --no-transfer-progress \
  -f "services/${service}/pom.xml" \
  -DskipTests=false \
  -Djacoco.skip=false \
  -Pcoverage \
  verify 2>&1 | tee "$log_file"
