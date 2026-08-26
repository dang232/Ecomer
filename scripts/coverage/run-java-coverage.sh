#!/usr/bin/env bash
set -euo pipefail

service="${1:?usage: $0 <service-directory> [log-file]}"
log_file="${2:-${service##*/}-coverage.log}"

cd "$(dirname "$0")/../.."

mvn --batch-mode --no-transfer-progress \
  -f "services/${service}/pom.xml" \
  -DskipTests=false \
  -Djacoco.skip=false \
  verify 2>&1 | tee "$log_file"
