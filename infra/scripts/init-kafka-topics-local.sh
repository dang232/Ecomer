#!/usr/bin/env bash
set -euo pipefail

# Compose-only Kafka bootstrap. Production uses init-kafka-topics.sh, which
# requires SASL_SSL, mutual TLS, and replicated topics. This broker is a
# single local node, so it intentionally uses SASL_PLAINTEXT and RF=1.

case "${VNSHOP_KAFKA_TARGET:-local}" in
  local) ;;
  *)
    echo "refusing non-local Kafka bootstrap target" >&2
    exit 64
    ;;
esac

BROKER="${KAFKA_BOOTSTRAP_SERVERS:-kafka:9092}"
ADMIN_CONFIG=/tmp/admin.properties
INVENTORY_AUTHORITY=infra/kafka/topic-inventory.yaml
CANONICAL_AUTHORITY=infra/kafka/canonical-topics.json
READINESS_TIMEOUT_SECONDS="${KAFKA_READINESS_TIMEOUT_SECONDS:-30}"

cleanup() {
  rm -f "$ADMIN_CONFIG"
}
trap cleanup EXIT

test -f "$INVENTORY_AUTHORITY" || {
  echo "Kafka inventory authority is required: $INVENTORY_AUTHORITY" >&2
  exit 65
}

test -f "$CANONICAL_AUTHORITY" || {
  echo "Kafka canonical topic authority is required: $CANONICAL_AUTHORITY" >&2
  exit 66
}

cat > "$ADMIN_CONFIG" <<EOF
security.protocol=SASL_PLAINTEXT
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username="admin" password="${KAFKA_ADMIN_PASSWORD:?KAFKA_ADMIN_PASSWORD is required}";
EOF

echo "Waiting for local Kafka to be ready (timeout=${READINESS_TIMEOUT_SECONDS}s)..."
deadline=$((SECONDS + READINESS_TIMEOUT_SECONDS))
delay=1
until kafka-broker-api-versions --bootstrap-server "$BROKER" --command-config "$ADMIN_CONFIG" >/dev/null 2>&1; do
  if (( SECONDS >= deadline )); then
    echo "Kafka did not become ready within ${READINESS_TIMEOUT_SECONDS}s: ${BROKER}" >&2
    exit 70
  fi
  sleep "$delay"
  if (( delay < 5 )); then
    delay=$((delay + 1))
  fi
done

awk -F'"' '/^    "[^"].*",?$/{ print $2 }' "$CANONICAL_AUTHORITY" | while IFS= read -r topic; do
  kafka-topics --bootstrap-server "$BROKER" --command-config "$ADMIN_CONFIG" \
    --create --if-not-exists --topic "$topic" --partitions 6 \
    --replication-factor 1 --config min.insync.replicas=1
done

awk '
  /^- name: / { name = $3 }
  /^  partitions: / { print name ":" $2 }
' "$INVENTORY_AUTHORITY" | while IFS=: read -r topic partitions; do
  kafka-topics --bootstrap-server "$BROKER" --command-config "$ADMIN_CONFIG" \
    --create --if-not-exists --topic "$topic" --partitions "$partitions" \
    --replication-factor 1 --config min.insync.replicas=1
done

echo "Local Kafka topics created."
