#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
services=(
  product-service
)

for service in "${services[@]}"; do
  pom="$repo_root/services/$service/pom.xml"
  test -f "$pom"
  grep -q '<artifactId>jacoco-maven-plugin</artifactId>' "$pom"
  test "$(grep -c '<counter>LINE</counter>' "$pom")" -ge 1
  test "$(grep -c '<counter>BRANCH</counter>' "$pom")" -ge 1
  test "$(grep -c '<minimum>0.90</minimum>' "$pom")" -ge 2
  if grep -q '<skip>true</skip>' "$pom"; then
    echo "JaCoCo skip remains enabled in $pom" >&2
    exit 1
  fi
done

echo "Validated JaCoCo LINE and BRANCH 0.90 gates for ${#services[@]} Java services."
