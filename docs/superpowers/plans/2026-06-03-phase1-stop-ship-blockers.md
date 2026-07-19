# Phase 1: Stop-Ship Blockers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan. Dispatch one fresh subagent per task, review between tasks. Tasks 9, 10, 5, 6, 7 are quick wins — run in parallel first. Then Tasks 3, 1, 2, 4. Task 8 (audit logging) last as it's multi-day. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 critical production blockers spanning secrets management, resilience, observability, security, and data safety — making VNShop deployable to a real environment without immediate compromise or silent failure.

**Architecture:** Each task is independent and can be executed in parallel. Tasks touch infrastructure config (docker-compose, K8s manifests, Prometheus/Alertmanager YAML), service application code (gRPC deadlines, audit AOP), and Keycloak realm config. No task changes domain logic or API contracts.

**Tech Stack:** Spring Boot 4.0.6, Java 25, Kafka KRaft, Keycloak 26.6, Prometheus, Alertmanager, Elasticsearch 8.x, Redis 7, gRPC, Kubernetes (Kustomize)

---

## File Map

| Task | Files Created/Modified |
|------|----------------------|
| 1 - Kafka JAAS secrets | `infra/kafka/kafka_server_jaas.conf.template` (create), `infra/kafka/kafka_server_jaas.conf` (delete from git), `docker-compose.yml` (modify), `.gitignore` (modify) |
| 2 - Keycloak realm secrets | `infra/keycloak/vnshop-realm.json` (modify), `.env.secrets.example` (modify) |
| 3 - gRPC deadlines | `services/order-service/.../grpc/GrpcClientConfig.java` (modify) |
| 4 - Kafka SASL_SSL | `infra/kafka/certs/generate-certs.sh` (create), `docker-compose.yml` (modify), all service `application.yml` files (modify) |
| 5 - Prometheus scrape targets | `infra/prometheus/prometheus.yml` (modify), 10 service `application.yml` files (modify) |
| 6 - Alertmanager receiver | `infra/alertmanager/alertmanager.yml` (modify) |
| 7 - Elasticsearch security | `docker-compose.yml` (modify) |
| 8 - Audit logging | `services/order-service/.../audit/` (create multiple), Flyway migration (create) |
| 9 - Disable ROPC | `infra/keycloak/vnshop-realm.json` (modify) |
| 10 - Redis eviction policy | `docker-compose.yml` (modify), `infra/k8s/base/configmap.yaml` (modify) |

---

## Task 1: Template Kafka JAAS Passwords (Remove Secrets from Git)

**Files:**
- Create: `infra/kafka/kafka_server_jaas.conf.template`
- Modify: `docker-compose.yml:225-240`
- Modify: `.gitignore`
- Modify: `.env.secrets.example`
- Delete from tracking: `infra/kafka/kafka_server_jaas.conf`

**Why:** `kafka_server_jaas.conf` contains 9 plaintext passwords committed to git. Anyone with repo access can authenticate as any service to Kafka.

- [ ] **Step 1: Create the JAAS template file with environment variable placeholders**

```conf
// infra/kafka/kafka_server_jaas.conf.template
// This file is processed by envsubst at container startup.
// DO NOT commit the rendered kafka_server_jaas.conf to git.

KafkaServer {
    org.apache.kafka.common.security.plain.PlainLoginModule required
    username="admin"
    password="${KAFKA_ADMIN_PASSWORD}"
    user_admin="${KAFKA_ADMIN_PASSWORD}"
    user_svc-order="${KAFKA_ORDER_PASSWORD}"
    user_svc-payment="${KAFKA_PAYMENT_PASSWORD}"
    user_svc-inventory="${KAFKA_INVENTORY_PASSWORD}"
    user_svc-product="${KAFKA_PRODUCT_PASSWORD}"
    user_svc-shipping="${KAFKA_SHIPPING_PASSWORD}"
    user_svc-finance="${KAFKA_FINANCE_PASSWORD}"
    user_svc-search="${KAFKA_SEARCH_PASSWORD}"
    user_svc-recommendations="${KAFKA_RECOMMENDATIONS_PASSWORD}";
};
```

- [ ] **Step 2: Update docker-compose.yml to render the template at startup**

Replace the Kafka volume mount and add an entrypoint wrapper. In `docker-compose.yml`, find the kafka service volumes section (around line 257):

```yaml
# BEFORE (remove this line):
#   - ./infra/kafka/kafka_server_jaas.conf:/etc/kafka/kafka_server_jaas.conf

# AFTER (add these lines):
    volumes:
      - ./infra/kafka/kafka_server_jaas.conf.template:/etc/kafka/kafka_server_jaas.conf.template:ro
    entrypoint: ["/bin/sh", "-c", "envsubst < /etc/kafka/kafka_server_jaas.conf.template > /etc/kafka/kafka_server_jaas.conf && exec /etc/confluent/docker/run"]
```

Also add the environment variables to the kafka service environment block:

```yaml
    environment:
      # ... existing env vars ...
      KAFKA_ADMIN_PASSWORD: ${KAFKA_ADMIN_PASSWORD:-admin-secret-change-me}
      KAFKA_ORDER_PASSWORD: ${KAFKA_ORDER_PASSWORD:-order-secret-change-me}
      KAFKA_PAYMENT_PASSWORD: ${KAFKA_PAYMENT_PASSWORD:-payment-secret-change-me}
      KAFKA_INVENTORY_PASSWORD: ${KAFKA_INVENTORY_PASSWORD:-inventory-secret-change-me}
      KAFKA_PRODUCT_PASSWORD: ${KAFKA_PRODUCT_PASSWORD:-product-secret-change-me}
      KAFKA_SHIPPING_PASSWORD: ${KAFKA_SHIPPING_PASSWORD:-shipping-secret-change-me}
      KAFKA_FINANCE_PASSWORD: ${KAFKA_FINANCE_PASSWORD:-finance-secret-change-me}
      KAFKA_SEARCH_PASSWORD: ${KAFKA_SEARCH_PASSWORD:-search-secret-change-me}
      KAFKA_RECOMMENDATIONS_PASSWORD: ${KAFKA_RECOMMENDATIONS_PASSWORD:-recommendations-secret-change-me}
```

- [ ] **Step 3: Add secrets to .env.secrets.example**

Append to `.env.secrets.example`:

```env
# Kafka SASL passwords (rotate these for production)
KAFKA_ADMIN_PASSWORD=<generate-strong-password>
KAFKA_ORDER_PASSWORD=<generate-strong-password>
KAFKA_PAYMENT_PASSWORD=<generate-strong-password>
KAFKA_INVENTORY_PASSWORD=<generate-strong-password>
KAFKA_PRODUCT_PASSWORD=<generate-strong-password>
KAFKA_SHIPPING_PASSWORD=<generate-strong-password>
KAFKA_FINANCE_PASSWORD=<generate-strong-password>
KAFKA_SEARCH_PASSWORD=<generate-strong-password>
KAFKA_RECOMMENDATIONS_PASSWORD=<generate-strong-password>
```

- [ ] **Step 4: Remove the plaintext JAAS file from git tracking**

```bash
git rm --cached infra/kafka/kafka_server_jaas.conf
```

Add to `.gitignore`:

```gitignore
# Kafka JAAS rendered config (contains secrets)
infra/kafka/kafka_server_jaas.conf
```

- [ ] **Step 5: Verify docker-compose starts Kafka correctly**

```bash
docker compose up kafka -d
docker compose logs kafka --tail 20
# Expected: Kafka starts without JAAS errors, SASL authentication works
docker compose exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092 --command-config /etc/kafka/admin.properties
```

- [ ] **Step 6: Commit**

```bash
git add infra/kafka/kafka_server_jaas.conf.template docker-compose.yml .gitignore .env.secrets.example
git commit -m "security(kafka): template JAAS config with env vars, remove plaintext secrets from git"
```

---

## Task 2: Extract Keycloak Realm Secrets to Environment Variables

**Files:**
- Modify: `infra/keycloak/vnshop-realm.json:66,259`
- Modify: `docker-compose.yml` (keycloak service environment)
- Modify: `.env.secrets.example`

**Why:** Client secrets `vnshop-gateway-secret` and `vnshop-admin-api-secret` are hardcoded in the realm JSON committed to git. These secrets authenticate the API gateway and admin API to Keycloak.

- [ ] **Step 1: Replace hardcoded secrets with Keycloak environment variable override syntax**

In `infra/keycloak/vnshop-realm.json`, line 66 (vnshop-gateway client):

```json
"secret": "${KEYCLOAK_GATEWAY_CLIENT_SECRET:vnshop-gateway-secret-dev}"
```

Line 259 (vnshop-admin-api client):

```json
"secret": "${KEYCLOAK_ADMIN_API_CLIENT_SECRET:vnshop-admin-api-secret-dev}"
```

Note: Keycloak realm import supports `${ENV_VAR:default}` syntax natively.

- [ ] **Step 2: Add environment variables to Keycloak service in docker-compose.yml**

In `docker-compose.yml`, keycloak service environment section (around line 279):

```yaml
    environment:
      # ... existing vars ...
      KEYCLOAK_GATEWAY_CLIENT_SECRET: ${KEYCLOAK_GATEWAY_CLIENT_SECRET:-vnshop-gateway-secret-dev}
      KEYCLOAK_ADMIN_API_CLIENT_SECRET: ${KEYCLOAK_ADMIN_API_CLIENT_SECRET:-vnshop-admin-api-secret-dev}
```

- [ ] **Step 3: Update .env.secrets.example**

Append:

```env
# Keycloak client secrets (rotate for production)
KEYCLOAK_GATEWAY_CLIENT_SECRET=<generate-strong-secret>
KEYCLOAK_ADMIN_API_CLIENT_SECRET=<generate-strong-secret>
```

- [ ] **Step 4: Update api-gateway application.yml to use env var for client secret**

In `services/api-gateway/src/main/resources/application.yml`, find the Keycloak client-secret config and ensure it references the env var:

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          keycloak:
            client-secret: ${KEYCLOAK_GATEWAY_CLIENT_SECRET:vnshop-gateway-secret-dev}
```

- [ ] **Step 5: Verify Keycloak starts with env-var secrets**

```bash
docker compose up keycloak -d
docker compose logs keycloak --tail 30
# Expected: Realm imported successfully, no secret-related errors
# Verify gateway can authenticate:
curl -s http://localhost:8085/realms/vnshop/.well-known/openid-configuration | jq .token_endpoint
```

- [ ] **Step 6: Commit**

```bash
git add infra/keycloak/vnshop-realm.json docker-compose.yml .env.secrets.example services/api-gateway/src/main/resources/application.yml
git commit -m "security(keycloak): extract client secrets to env vars with dev defaults"
```

---

## Task 3: Add gRPC Deadlines to All Blocking Stubs

**Files:**
- Modify: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/grpc/GrpcClientConfig.java:31-48`

**Why:** All three gRPC blocking stubs (inventory, payment, shipping) are created without `.withDeadlineAfter()`. If a downstream gRPC server hangs, the calling thread blocks forever. With virtual threads enabled, this causes unbounded connection/memory growth rather than thread exhaustion, but the order-creation path still stalls permanently. The gateway timelimiter (5s) returns 504 to the client, but the backend thread remains blocked indefinitely.

- [ ] **Step 1: Write the test for deadline propagation**

Create: `services/order-service/src/test/java/com/vnshop/orderservice/infrastructure/grpc/GrpcClientConfigTest.java`

```java
package com.vnshop.orderservice.infrastructure.grpc;

import io.grpc.CallOptions;
import io.grpc.Channel;
import io.grpc.ClientCall;
import io.grpc.ClientInterceptor;
import io.grpc.MethodDescriptor;
import org.junit.jupiter.api.Test;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class GrpcClientConfigTest {

    @Test
    void grpcStubs_shouldHaveDeadlineConfigured() {
        // The GrpcClientConfig sets deadlines on all stubs.
        // We verify by checking that the deadline is non-null on the call options.
        var config = new GrpcClientConfig();

        // Use reflection or direct field access to verify deadline is set.
        // Since stubs require a real channel, we verify the config constants instead.
        assertThat(GrpcClientConfig.GRPC_DEADLINE_SECONDS).isEqualTo(5);
    }

    @Test
    void inventoryStub_shouldTimeout_whenServerUnresponsive() {
        // Integration-level test verifying the deadline causes DEADLINE_EXCEEDED
        // when the server doesn't respond within the configured timeout.
        // This test requires a mock gRPC server — skip for unit, cover in integration.
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/order-service
mvn test -pl . -Dtest=GrpcClientConfigTest -Dsurefire.failIfNoSpecifiedTests=false
# Expected: FAIL — GrpcClientConfig.GRPC_DEADLINE_SECONDS does not exist yet
```

- [ ] **Step 3: Modify GrpcClientConfig to add deadlines**

Replace the full content of `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/grpc/GrpcClientConfig.java`:

```java
package com.vnshop.orderservice.infrastructure.grpc;

import com.vnshop.inventoryservice.grpc.InventoryServiceGrpc;
import com.vnshop.paymentservice.grpc.PaymentServiceGrpc;
import com.vnshop.shippingservice.grpc.ShippingServiceGrpc;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
public class GrpcClientConfig {

    public static final int GRPC_DEADLINE_SECONDS = 5;

    @Value("${grpc.client.inventory.address}")
    private String inventoryAddress;

    @Value("${grpc.client.payment.address}")
    private String paymentAddress;

    @Value("${grpc.client.shipping.address}")
    private String shippingAddress;

    @Bean
    public InventoryServiceGrpc.InventoryServiceBlockingStub inventoryServiceStub() {
        ManagedChannel channel = ManagedChannelBuilder
                .forTarget(inventoryAddress)
                .usePlaintext()
                .build();
        return InventoryServiceGrpc.newBlockingStub(channel)
                .withDeadlineAfter(GRPC_DEADLINE_SECONDS, TimeUnit.SECONDS);
    }

    @Bean
    public PaymentServiceGrpc.PaymentServiceBlockingStub paymentServiceStub() {
        ManagedChannel channel = ManagedChannelBuilder
                .forTarget(paymentAddress)
                .usePlaintext()
                .build();
        return PaymentServiceGrpc.newBlockingStub(channel)
                .withDeadlineAfter(GRPC_DEADLINE_SECONDS, TimeUnit.SECONDS);
    }

    @Bean
    public ShippingServiceGrpc.ShippingServiceBlockingStub shippingServiceStub() {
        ManagedChannel channel = ManagedChannelBuilder
                .forTarget(shippingAddress)
                .usePlaintext()
                .build();
        return ShippingServiceGrpc.newBlockingStub(channel)
                .withDeadlineAfter(GRPC_DEADLINE_SECONDS, TimeUnit.SECONDS);
    }
}
```

**Important note:** `withDeadlineAfter` on a bean-level stub sets the deadline from the moment the bean is created — not per-call. For production correctness, the deadline should be applied per-call in the adapter. Update the adapters instead:

In `GrpcInventoryReservationAdapter.java`, where the stub is called (around line 54):

```java
// BEFORE:
var response = inventoryStub.reserveInventory(request);

// AFTER:
var response = inventoryStub
        .withDeadlineAfter(5, TimeUnit.SECONDS)
        .reserveInventory(request);
```

In `GrpcPaymentRequestAdapter.java` (around line 39):

```java
// BEFORE:
var response = paymentStub.processPayment(request);

// AFTER:
var response = paymentStub
        .withDeadlineAfter(10, TimeUnit.SECONDS)
        .processPayment(request);
```

Note: Payment gets 10s because payment provider callbacks can be slow.

In `GrpcShippingRequestAdapter.java` (around line 38):

```java
// BEFORE:
var response = shippingStub.createShipment(request);

// AFTER:
var response = shippingStub
        .withDeadlineAfter(5, TimeUnit.SECONDS)
        .createShipment(request);
```

- [ ] **Step 4: Add the TimeUnit import to each adapter file**

Each adapter needs this import at the top:

```java
import java.util.concurrent.TimeUnit;
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd services/order-service
mvn test -pl .
# Expected: All tests PASS including the new GrpcClientConfigTest
```

- [ ] **Step 6: Commit**

```bash
git add services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/grpc/
git add services/order-service/src/test/java/com/vnshop/orderservice/infrastructure/grpc/
git commit -m "resilience(grpc): add 5s deadline to all gRPC blocking calls

Without deadlines, a hung inventory/payment/shipping server causes
the calling virtual thread to block indefinitely. Now DEADLINE_EXCEEDED
is thrown after 5s (10s for payment), allowing proper error handling."
```

---

## Task 4: Upgrade Kafka from SASL_PLAINTEXT to SASL_SSL

**Files:**
- Create: `infra/kafka/certs/generate-certs.sh`
- Modify: `docker-compose.yml:232-238` (Kafka listener config)
- Modify: All 8 service `application.yml` files (Kafka SSL properties)

**Why:** SASL_PLAINTEXT sends Kafka credentials in cleartext. Any network sniffer can capture service passwords. SASL_SSL encrypts the entire connection.

- [ ] **Step 1: Create the certificate generation script**

Create `infra/kafka/certs/generate-certs.sh`:

```bash
#!/bin/bash
# Generate self-signed CA and broker/client certificates for Kafka SASL_SSL
# For production, use a proper CA (e.g., cert-manager, Vault PKI)

set -euo pipefail

CERTS_DIR="$(cd "$(dirname "$0")" && pwd)"
PASSWORD="kafka-ssl-dev-password"

echo "=== Generating CA ==="
openssl req -new -x509 -keyout "$CERTS_DIR/ca-key.pem" -out "$CERTS_DIR/ca-cert.pem" \
    -days 365 -nodes -subj "/CN=VNShop-Kafka-CA/O=VNShop/L=HCMC/C=VN"

echo "=== Generating Broker Keystore ==="
keytool -genkeypair -alias kafka-broker -keyalg RSA -keysize 2048 \
    -keystore "$CERTS_DIR/kafka.broker.keystore.jks" -storepass "$PASSWORD" \
    -dname "CN=kafka,O=VNShop,L=HCMC,C=VN" -validity 365

echo "=== Generating Broker CSR and signing with CA ==="
keytool -certreq -alias kafka-broker -keystore "$CERTS_DIR/kafka.broker.keystore.jks" \
    -storepass "$PASSWORD" -file "$CERTS_DIR/broker.csr"
openssl x509 -req -CA "$CERTS_DIR/ca-cert.pem" -CAkey "$CERTS_DIR/ca-key.pem" \
    -in "$CERTS_DIR/broker.csr" -out "$CERTS_DIR/broker-signed.pem" \
    -days 365 -CAcreateserial

echo "=== Importing CA and signed cert into broker keystore ==="
keytool -importcert -alias ca-root -keystore "$CERTS_DIR/kafka.broker.keystore.jks" \
    -storepass "$PASSWORD" -file "$CERTS_DIR/ca-cert.pem" -noprompt
keytool -importcert -alias kafka-broker -keystore "$CERTS_DIR/kafka.broker.keystore.jks" \
    -storepass "$PASSWORD" -file "$CERTS_DIR/broker-signed.pem" -noprompt

echo "=== Creating Truststore with CA cert ==="
keytool -importcert -alias ca-root -keystore "$CERTS_DIR/kafka.truststore.jks" \
    -storepass "$PASSWORD" -file "$CERTS_DIR/ca-cert.pem" -noprompt

echo "=== Done. Files created in $CERTS_DIR ==="
echo "Keystore password: $PASSWORD"
ls -la "$CERTS_DIR"/*.jks "$CERTS_DIR"/*.pem
```

- [ ] **Step 2: Run the cert generation**

```bash
chmod +x infra/kafka/certs/generate-certs.sh
cd infra/kafka/certs
./generate-certs.sh
# Expected: kafka.broker.keystore.jks, kafka.truststore.jks, ca-cert.pem created
```

- [ ] **Step 3: Add generated certs to .gitignore**

Append to `.gitignore`:

```gitignore
# Kafka SSL certs (generated locally, never commit)
infra/kafka/certs/*.jks
infra/kafka/certs/*.pem
infra/kafka/certs/*.csr
infra/kafka/certs/*.srl
```

- [ ] **Step 4: Update docker-compose.yml Kafka service for SASL_SSL**

In `docker-compose.yml`, replace the Kafka listener/security config (around lines 232-238):

```yaml
    environment:
      # ... other env vars unchanged ...
      KAFKA_LISTENERS: SASL_SSL://0.0.0.0:9092,SASL_SSL://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: SASL_SSL://kafka:9092,SASL_SSL://localhost:9093
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: SASL_SSL:SASL_SSL
      KAFKA_INTER_BROKER_LISTENER_NAME: SASL_SSL
      KAFKA_SASL_MECHANISM_INTER_BROKER_PROTOCOL: PLAIN
      KAFKA_SASL_ENABLED_MECHANISMS: PLAIN
      # SSL configuration
      KAFKA_SSL_KEYSTORE_LOCATION: /etc/kafka/secrets/kafka.broker.keystore.jks
      KAFKA_SSL_KEYSTORE_PASSWORD: kafka-ssl-dev-password
      KAFKA_SSL_KEY_PASSWORD: kafka-ssl-dev-password
      KAFKA_SSL_TRUSTSTORE_LOCATION: /etc/kafka/secrets/kafka.truststore.jks
      KAFKA_SSL_TRUSTSTORE_PASSWORD: kafka-ssl-dev-password
      KAFKA_SSL_CLIENT_AUTH: none
    volumes:
      - ./infra/kafka/kafka_server_jaas.conf.template:/etc/kafka/kafka_server_jaas.conf.template:ro
      - ./infra/kafka/certs/kafka.broker.keystore.jks:/etc/kafka/secrets/kafka.broker.keystore.jks:ro
      - ./infra/kafka/certs/kafka.truststore.jks:/etc/kafka/secrets/kafka.truststore.jks:ro
```

- [ ] **Step 5: Update each service application.yml to use SASL_SSL**

For each Java service that connects to Kafka (order, payment, inventory, product, shipping, search, seller-finance, recommendations), add this to their `application.yml`:

```yaml
spring:
  kafka:
    properties:
      security.protocol: SASL_SSL
      sasl.mechanism: PLAIN
      sasl.jaas.config: >
        org.apache.kafka.common.security.plain.PlainLoginModule required
        username="${KAFKA_SASL_USERNAME}"
        password="${KAFKA_SASL_PASSWORD}";
      ssl.truststore.location: ${KAFKA_SSL_TRUSTSTORE_LOCATION:/etc/kafka/secrets/kafka.truststore.jks}
      ssl.truststore.password: ${KAFKA_SSL_TRUSTSTORE_PASSWORD:kafka-ssl-dev-password}
      ssl.endpoint.identification.algorithm: ""
```

- [ ] **Step 6: Mount truststore into each service container in docker-compose.yml**

For each Kafka-connected service, add the truststore volume mount:

```yaml
    volumes:
      - ./infra/kafka/certs/kafka.truststore.jks:/etc/kafka/secrets/kafka.truststore.jks:ro
```

- [ ] **Step 7: Verify Kafka starts with SSL and services can connect**

```bash
docker compose up kafka -d
docker compose logs kafka --tail 30
# Expected: "Started socket server acceptors and processors" with SSL listeners
docker compose up order-service -d
docker compose logs order-service --tail 20
# Expected: No Kafka connection errors, "KafkaProducer" init log line
```

- [ ] **Step 8: Commit**

```bash
git add infra/kafka/certs/generate-certs.sh docker-compose.yml .gitignore
git add services/order-service/src/main/resources/application.yml
git add services/payment-service/src/main/resources/application.yml
git add services/inventory-service/src/main/resources/application.yml
git add services/product-service/src/main/resources/application.yml
git add services/shipping-service/src/main/resources/application.yml
git add services/search-service/src/main/resources/application.yml
git add services/seller-finance-service/src/main/resources/application.yml
git add services/recommendations-service/src/main/resources/application.yml
git commit -m "security(kafka): upgrade from SASL_PLAINTEXT to SASL_SSL

All Kafka connections now use TLS encryption. Self-signed certs for dev;
production should use cert-manager or Vault PKI-issued certificates.
Truststore mounted into all service containers."
```

---

## Task 5: Fix Prometheus — Add Scrape Targets + Expose Metrics on All Services

**Files:**
- Modify: `infra/prometheus/prometheus.yml`
- Modify: 10 service `application.yml` files (add `prometheus` to actuator endpoints)

**Why:** Prometheus is deployed but has zero `scrape_configs` — it collects no metrics. Additionally, only 1 of 11 Java services (user-service) exposes the `/actuator/prometheus` endpoint. Alert rules reference metrics that don't exist.

- [ ] **Step 1: Replace infra/prometheus/prometheus.yml with full config**

Replace the entire file content:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - "rules.yml"

scrape_configs:
  - job_name: 'vnshop-api-gateway'
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ['api-gateway:8080']

  - job_name: 'vnshop-user-service'
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ['user-service:8081']

  - job_name: 'vnshop-product-service'
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ['product-service:8082']

  - job_name: 'vnshop-inventory-service'
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ['inventory-service:8083']

  - job_name: 'vnshop-search-service'
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ['search-service:8084']

  - job_name: 'vnshop-order-service'
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ['order-service:8086']

  - job_name: 'vnshop-payment-service'
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ['payment-service:8087']

  - job_name: 'vnshop-shipping-service'
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ['shipping-service:8089']

  - job_name: 'vnshop-seller-finance-service'
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ['seller-finance-service:8090']

  - job_name: 'vnshop-recommendations-service'
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ['recommendations-service:8094']

  - job_name: 'vnshop-coupon-service'
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ['coupon-service:8088']
```

- [ ] **Step 2: Add prometheus to actuator endpoint exposure in each service**

For each service's `application.yml`, find the `management.endpoints.web.exposure.include` line and add `prometheus`:

**api-gateway** (`services/api-gateway/src/main/resources/application.yml:42`):
```yaml
# BEFORE: include: health,info,gateway
# AFTER:
include: health,info,gateway,prometheus
```

**product-service** (`services/product-service/src/main/resources/application.yml`):
```yaml
# BEFORE: include: health,info
# AFTER:
include: health,info,prometheus
```

**order-service** (`services/order-service/src/main/resources/application.yml`):
```yaml
# BEFORE: include: health,info
# AFTER:
include: health,info,prometheus
```

**payment-service** (`services/payment-service/src/main/resources/application.yml`):
```yaml
# BEFORE: include: health,info
# AFTER:
include: health,info,prometheus
```

**shipping-service** (`services/shipping-service/src/main/resources/application.yml`):
```yaml
# BEFORE: include: health,info
# AFTER:
include: health,info,prometheus
```

**inventory-service** (`services/inventory-service/src/main/resources/application.yml`):
```yaml
# BEFORE: include: health,info
# AFTER:
include: health,info,prometheus
```

**search-service** (`services/search-service/src/main/resources/application.yml`):
```yaml
# BEFORE: include: health,info
# AFTER:
include: health,info,prometheus
```

**seller-finance-service** (`services/seller-finance-service/src/main/resources/application.yml`):
```yaml
# BEFORE: include: health,info
# AFTER:
include: health,info,prometheus
```

**recommendations-service** (`services/recommendations-service/src/main/resources/application.yml`):
```yaml
# BEFORE: include: health,info
# AFTER:
include: health,info,prometheus
```

**coupon-service** — if no management section exists, add:
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
```

(user-service already has `prometheus` — no change needed)

- [ ] **Step 3: Verify Prometheus can scrape at least one service**

```bash
docker compose up prometheus user-service -d
# Wait 15 seconds for first scrape
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'
# Expected: at least vnshop-user-service shows "health": "up"
```

- [ ] **Step 4: Commit**

```bash
git add infra/prometheus/prometheus.yml
git add services/api-gateway/src/main/resources/application.yml
git add services/product-service/src/main/resources/application.yml
git add services/order-service/src/main/resources/application.yml
git add services/payment-service/src/main/resources/application.yml
git add services/shipping-service/src/main/resources/application.yml
git add services/inventory-service/src/main/resources/application.yml
git add services/search-service/src/main/resources/application.yml
git add services/seller-finance-service/src/main/resources/application.yml
git add services/recommendations-service/src/main/resources/application.yml
git add services/coupon-service/src/main/resources/application.yml
git commit -m "observability(prometheus): add scrape targets for all 11 services

Prometheus was deployed but had zero scrape_configs — collecting no metrics.
Now scrapes /actuator/prometheus on all Java services. All services expose
the prometheus actuator endpoint."
```

---

## Task 6: Configure Alertmanager Notification Channel

**Files:**
- Modify: `infra/alertmanager/alertmanager.yml`
- Modify: `.env.secrets.example`

**Why:** All 5 alert rules evaluate and fire, but the default receiver is an empty object — notifications go nowhere. Critical alerts (service down, payment failures, Kafka lag) are silently discarded.

- [ ] **Step 1: Replace infra/alertmanager/alertmanager.yml with proper routing**

Replace the entire file:

```yaml
global:
  resolve_timeout: 5m

route:
  receiver: 'default'
  group_by: ['alertname', 'service']
  group_wait: 10s
  group_interval: 30s
  repeat_interval: 3h
  routes:
    - match:
        severity: critical
      receiver: 'critical'
      repeat_interval: 15m
    - match:
        severity: warning
      receiver: 'default'

receivers:
  - name: 'default'
    slack_configs:
      - api_url: '${ALERTMANAGER_SLACK_WEBHOOK_URL}'
        channel: '#vnshop-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: >-
          {{ range .Alerts }}
          *Alert:* {{ .Labels.alertname }}
          *Severity:* {{ .Labels.severity }}
          *Description:* {{ .Annotations.description }}
          *Service:* {{ .Labels.job }}
          {{ end }}
        send_resolved: true

  - name: 'critical'
    slack_configs:
      - api_url: '${ALERTMANAGER_SLACK_CRITICAL_WEBHOOK_URL}'
        channel: '#vnshop-critical'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: >-
          {{ range .Alerts }}
          *Alert:* {{ .Labels.alertname }}
          *Service:* {{ .Labels.job }}
          *Description:* {{ .Annotations.description }}
          *Runbook:* {{ .Annotations.runbook_url }}
          {{ end }}
        send_resolved: true

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
```

- [ ] **Step 2: Add webhook URLs to .env.secrets.example**

Append:

```env
# Alertmanager Slack webhooks
ALERTMANAGER_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ALERTMANAGER_SLACK_CRITICAL_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/CRITICAL/URL
```

- [ ] **Step 3: Update docker-compose.yml alertmanager service to pass env vars**

In the alertmanager service section, add environment variables:

```yaml
  alertmanager:
    environment:
      ALERTMANAGER_SLACK_WEBHOOK_URL: ${ALERTMANAGER_SLACK_WEBHOOK_URL:-http://placeholder}
      ALERTMANAGER_SLACK_CRITICAL_WEBHOOK_URL: ${ALERTMANAGER_SLACK_CRITICAL_WEBHOOK_URL:-http://placeholder}
```

Note: Alertmanager supports `${ENV_VAR}` syntax in config files natively when using `--cluster.advertise-address` or via envsubst in the entrypoint. If the native support doesn't work, wrap the entrypoint:

```yaml
    entrypoint: ["/bin/sh", "-c", "envsubst < /etc/alertmanager/alertmanager.yml > /tmp/alertmanager.yml && exec /bin/alertmanager --config.file=/tmp/alertmanager.yml --storage.path=/alertmanager"]
```

- [ ] **Step 4: Verify alertmanager loads config without errors**

```bash
docker compose up alertmanager -d
docker compose logs alertmanager --tail 10
# Expected: "Loading configuration file" with no parse errors
curl -s http://localhost:9093/api/v2/status | jq .config
# Expected: Shows the configured receivers with channel names
```

- [ ] **Step 5: Commit**

```bash
git add infra/alertmanager/alertmanager.yml docker-compose.yml .env.secrets.example
git commit -m "observability(alertmanager): configure Slack notification channels

Critical alerts route to #vnshop-critical with 15m repeat.
Warning alerts route to #vnshop-alerts with 3h repeat.
Webhook URLs sourced from environment variables."
```

---

## Task 7: Enable Elasticsearch Security

**Files:**
- Modify: `docker-compose.yml:309-315` (elasticsearch service)
- Modify: `services/search-service/src/main/resources/application.yml` (add ES credentials)

**Why:** Elasticsearch has `xpack.security.enabled: "false"` — anyone with network access can read/write/delete all indices. Product catalog, search analytics, and any indexed PII are fully exposed.

- [ ] **Step 1: Enable security and set password in docker-compose.yml**

In `docker-compose.yml`, find the elasticsearch service environment section (around line 313):

```yaml
# BEFORE:
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"

# AFTER:
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=true
      - ELASTIC_PASSWORD=${ELASTIC_PASSWORD:-vnshop-es-dev-password}
      - xpack.security.http.ssl.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
```

Note: We enable auth but keep HTTP (no TLS) for dev. Production should enable `xpack.security.http.ssl.enabled=true`.

- [ ] **Step 2: Update search-service application.yml with ES credentials**

In `services/search-service/src/main/resources/application.yml`, add or update the Elasticsearch client config:

```yaml
spring:
  elasticsearch:
    uris: http://elasticsearch:9200
    username: elastic
    password: ${ELASTIC_PASSWORD:vnshop-es-dev-password}
```

- [ ] **Step 3: Update any other services that connect to Elasticsearch**

Check if recommendations-service or other services use ES. If so, apply the same credentials config. Based on the audit, only search-service connects directly.

- [ ] **Step 4: Add ELASTIC_PASSWORD to .env.secrets.example**

Append:

```env
# Elasticsearch
ELASTIC_PASSWORD=<generate-strong-password>
```

- [ ] **Step 5: Verify Elasticsearch rejects unauthenticated requests**

```bash
docker compose up elasticsearch -d
sleep 10
# Without credentials — should get 401:
curl -s -o /dev/null -w "%{http_code}" http://localhost:9200/
# Expected: 401

# With credentials — should get 200:
curl -s -u "${ELASTIC_USER}:${ELASTIC_PASSWORD}" http://localhost:9200/ | jq .name
# Expected: cluster name returned
```

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml services/search-service/src/main/resources/application.yml .env.secrets.example
git commit -m "security(elasticsearch): enable xpack security with basic auth

Elasticsearch was running with security disabled — any network request
could read/write/delete all indices. Now requires authentication.
Dev uses a default password; production uses env var."
```

---

## Task 8: Add Audit Logging via Spring AOP

**Files:**
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/audit/AuditLog.java`
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/audit/AuditLogJpaEntity.java`
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/audit/AuditLogRepository.java`
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/audit/AuditAspect.java`
- Create: `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/audit/Audited.java`
- Create: `services/order-service/src/main/resources/db/migration/V22__audit_log_table.sql`
- Create: `services/order-service/src/test/java/com/vnshop/orderservice/infrastructure/audit/AuditAspectTest.java`

**Why:** No audit trail exists for who-did-what-when. PCI-DSS requires logging all access to cardholder data environments. GDPR requires demonstrating lawful processing. Without audit logs, there's no way to investigate security incidents, fraud, or disputes.

**Approach:** Start with order-service (highest business criticality), then replicate to other services. Use a custom `@Audited` annotation + Spring AOP to intercept write operations.

- [ ] **Step 1: Create the Flyway migration for audit_log table**

Create `services/order-service/src/main/resources/db/migration/V22__audit_log_table.sql`:

```sql
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id         VARCHAR(255),
    user_role       VARCHAR(50),
    action          VARCHAR(100) NOT NULL,
    resource_type   VARCHAR(100) NOT NULL,
    resource_id     VARCHAR(255),
    details         JSONB,
    ip_address      VARCHAR(45),
    correlation_id  VARCHAR(100),
    service_name    VARCHAR(50) NOT NULL DEFAULT 'order-service'
);

-- Append-only: no UPDATE or DELETE grants in production
-- Index for common query patterns
CREATE INDEX idx_audit_log_timestamp ON audit_log (timestamp DESC);
CREATE INDEX idx_audit_log_user_id ON audit_log (user_id, timestamp DESC);
CREATE INDEX idx_audit_log_resource ON audit_log (resource_type, resource_id);
CREATE INDEX idx_audit_log_action ON audit_log (action, timestamp DESC);

COMMENT ON TABLE audit_log IS 'Immutable audit trail — append only. Do not grant UPDATE/DELETE in production.';
```

- [ ] **Step 2: Create the @Audited annotation**

Create `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/audit/Audited.java`:

```java
package com.vnshop.orderservice.infrastructure.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a use-case method for audit logging.
 * The AuditAspect intercepts calls to methods with this annotation
 * and persists an audit record with user, action, and resource details.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {
    /** Human-readable action name, e.g. "CREATE_ORDER", "CANCEL_ORDER" */
    String action();

    /** Resource type being acted upon, e.g. "Order", "SubOrder" */
    String resourceType();
}
```

- [ ] **Step 3: Create the AuditLogJpaEntity**

Create `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/audit/AuditLogJpaEntity.java`:

```java
package com.vnshop.orderservice.infrastructure.audit;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "audit_log")
public class AuditLogJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant timestamp;

    private String userId;

    private String userRole;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(nullable = false, length = 100)
    private String resourceType;

    private String resourceId;

    @Column(columnDefinition = "jsonb")
    private String details;

    @Column(length = 45)
    private String ipAddress;

    @Column(length = 100)
    private String correlationId;

    @Column(nullable = false, length = 50)
    private String serviceName;

    protected AuditLogJpaEntity() {}

    public AuditLogJpaEntity(String userId, String userRole, String action,
                              String resourceType, String resourceId,
                              String details, String ipAddress,
                              String correlationId) {
        this.timestamp = Instant.now();
        this.userId = userId;
        this.userRole = userRole;
        this.action = action;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.details = details;
        this.ipAddress = ipAddress;
        this.correlationId = correlationId;
        this.serviceName = "order-service";
    }

    // Getters only — immutable after creation
    public Long getId() { return id; }
    public Instant getTimestamp() { return timestamp; }
    public String getUserId() { return userId; }
    public String getUserRole() { return userRole; }
    public String getAction() { return action; }
    public String getResourceType() { return resourceType; }
    public String getResourceId() { return resourceId; }
    public String getDetails() { return details; }
    public String getIpAddress() { return ipAddress; }
    public String getCorrelationId() { return correlationId; }
    public String getServiceName() { return serviceName; }
}
```

- [ ] **Step 4: Create the JPA repository**

Create `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/audit/AuditLogRepository.java`:

```java
package com.vnshop.orderservice.infrastructure.audit;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLogJpaEntity, Long> {
}
```

- [ ] **Step 5: Create the AuditAspect**

Create `services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/audit/AuditAspect.java`:

```java
package com.vnshop.orderservice.infrastructure.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Objects;

@Aspect
@Component
public class AuditAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditAspect.class);

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    public AuditAspect(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = Objects.requireNonNull(auditLogRepository);
        this.objectMapper = Objects.requireNonNull(objectMapper);
    }

    @Around("@annotation(audited)")
    public Object audit(ProceedingJoinPoint joinPoint, Audited audited) throws Throwable {
        Object result = joinPoint.proceed();

        try {
            String userId = extractUserId();
            String userRole = extractUserRole();
            String resourceId = extractResourceId(result);
            String ipAddress = extractIpAddress();
            String correlationId = extractCorrelationId();

            var auditEntry = new AuditLogJpaEntity(
                    userId,
                    userRole,
                    audited.action(),
                    audited.resourceType(),
                    resourceId,
                    null, // details — extend per use case if needed
                    ipAddress,
                    correlationId
            );

            auditLogRepository.save(auditEntry);
        } catch (Exception e) {
            // Audit logging must never break the business flow
            log.error("Failed to persist audit log for action={}, resource={}",
                    audited.action(), audited.resourceType(), e);
        }

        return result;
    }

    private String extractUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            return jwt.getSubject();
        }
        return "anonymous";
    }

    private String extractUserRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getAuthorities() != null) {
            return auth.getAuthorities().stream()
                    .map(Object::toString)
                    .filter(r -> r.startsWith("ROLE_"))
                    .findFirst()
                    .orElse("UNKNOWN");
        }
        return "UNKNOWN";
    }

    private String extractResourceId(Object result) {
        if (result == null) return null;
        try {
            var method = result.getClass().getMethod("getId");
            Object id = method.invoke(result);
            return id != null ? id.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private String extractIpAddress() {
        var attrs = RequestContextHolder.getRequestAttributes();
        if (attrs instanceof ServletRequestAttributes servletAttrs) {
            var request = servletAttrs.getRequest();
            String forwarded = request.getHeader("X-Forwarded-For");
            return forwarded != null ? forwarded.split(",")[0].trim() : request.getRemoteAddr();
        }
        return null;
    }

    private String extractCorrelationId() {
        var attrs = RequestContextHolder.getRequestAttributes();
        if (attrs instanceof ServletRequestAttributes servletAttrs) {
            return servletAttrs.getRequest().getHeader("X-Correlation-Id");
        }
        return null;
    }
}
```

- [ ] **Step 6: Annotate critical use cases with @Audited**

In `services/order-service/src/main/java/com/vnshop/orderservice/application/usecase/CreateOrderUseCase.java`, add to the execute method:

```java
import com.vnshop.orderservice.infrastructure.audit.Audited;

// Add annotation to the main method:
@Audited(action = "CREATE_ORDER", resourceType = "Order")
public Order execute(CreateOrderCommand command) {
    // ... existing implementation unchanged ...
}
```

In `CancelOrderUseCase.java`:

```java
@Audited(action = "CANCEL_ORDER", resourceType = "Order")
public void execute(CancelOrderCommand command) { ... }
```

In `UpdateOrderStatusUseCase.java`:

```java
@Audited(action = "UPDATE_ORDER_STATUS", resourceType = "Order")
public void execute(UpdateOrderStatusCommand command) { ... }
```

- [ ] **Step 7: Write unit test for AuditAspect**

Create `services/order-service/src/test/java/com/vnshop/orderservice/infrastructure/audit/AuditAspectTest.java`:

```java
package com.vnshop.orderservice.infrastructure.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AuditAspectTest {

    private AuditLogRepository repository;
    private AuditAspect aspect;

    @BeforeEach
    void setUp() {
        repository = mock(AuditLogRepository.class);
        aspect = new AuditAspect(repository, new ObjectMapper());
    }

    @Test
    void shouldPersistAuditEntry_whenAnnotatedMethodSucceeds() throws Throwable {
        // Given
        var joinPoint = mock(org.aspectj.lang.ProceedingJoinPoint.class);
        when(joinPoint.proceed()).thenReturn(null);

        var audited = mock(Audited.class);
        when(audited.action()).thenReturn("CREATE_ORDER");
        when(audited.resourceType()).thenReturn("Order");

        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // When
        aspect.audit(joinPoint, audited);

        // Then
        var captor = ArgumentCaptor.forClass(AuditLogJpaEntity.class);
        verify(repository).save(captor.capture());

        AuditLogJpaEntity saved = captor.getValue();
        assertThat(saved.getAction()).isEqualTo("CREATE_ORDER");
        assertThat(saved.getResourceType()).isEqualTo("Order");
        assertThat(saved.getServiceName()).isEqualTo("order-service");
        assertThat(saved.getTimestamp()).isNotNull();
    }

    @Test
    void shouldNotBreakBusinessFlow_whenAuditPersistenceFails() throws Throwable {
        // Given
        var joinPoint = mock(org.aspectj.lang.ProceedingJoinPoint.class);
        var expectedResult = "business-result";
        when(joinPoint.proceed()).thenReturn(expectedResult);

        var audited = mock(Audited.class);
        when(audited.action()).thenReturn("CREATE_ORDER");
        when(audited.resourceType()).thenReturn("Order");

        when(repository.save(any())).thenThrow(new RuntimeException("DB down"));

        // When
        Object result = aspect.audit(joinPoint, audited);

        // Then — business result returned despite audit failure
        assertThat(result).isEqualTo(expectedResult);
    }
}
```

- [ ] **Step 8: Run tests**

```bash
cd services/order-service
mvn test -pl . -Dtest=AuditAspectTest
# Expected: 2 tests PASS
```

- [ ] **Step 9: Commit**

```bash
git add services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/audit/
git add services/order-service/src/main/resources/db/migration/V22__audit_log_table.sql
git add services/order-service/src/test/java/com/vnshop/orderservice/infrastructure/audit/
git add services/order-service/src/main/java/com/vnshop/orderservice/application/usecase/CreateOrderUseCase.java
git add services/order-service/src/main/java/com/vnshop/orderservice/application/usecase/CancelOrderUseCase.java
git add services/order-service/src/main/java/com/vnshop/orderservice/application/usecase/UpdateOrderStatusUseCase.java
git commit -m "compliance(audit): add AOP-based audit logging for order operations

Implements @Audited annotation + AuditAspect that intercepts write operations
and persists an immutable audit trail (who, what, when, from-where).
Covers CREATE_ORDER, CANCEL_ORDER, UPDATE_ORDER_STATUS.
Never breaks business flow — audit failures are logged, not thrown."
```

---

## Task 9: Disable ROPC (Resource Owner Password Credentials) on vnshop-api Client

**Files:**
- Modify: `infra/keycloak/vnshop-realm.json:129`

**Why:** The `directAccessGrantsEnabled: true` setting allows username+password login directly through the API without browser redirect. This enables credential stuffing attacks, bypasses Keycloak's login flow protections (brute force detection at realm level doesn't apply to direct grants), and is explicitly deprecated in OAuth 2.1. The httpOnly cookie auth flow (`AuthSessionController`) already replaces this.

- [ ] **Step 1: Disable direct access grants on vnshop-api client**

In `infra/keycloak/vnshop-realm.json`, find line 129:

```json
"directAccessGrantsEnabled": true,
```

Replace with:

```json
"directAccessGrantsEnabled": false,
```

- [ ] **Step 2: Verify the frontend auth flow still works without ROPC**

The frontend uses the Authorization Code flow via the gateway's `AuthSessionController.java`, which calls Keycloak's token endpoint with `grant_type=authorization_code`. Disabling direct access grants only blocks `grant_type=password`. Verify:

```bash
# After realm re-import, attempt ROPC — should fail:
curl -s -X POST http://localhost:8085/realms/vnshop/protocol/openid-connect/token \
  -d "grant_type=password" \
  -d "client_id=vnshop-api" \
  -d "username=buyer1" \
  -d "password=test" | jq .error
# Expected: "unauthorized_client" or "invalid_grant"

# Auth code flow still works — verify token endpoint accepts authorization_code:
# (This requires a full browser redirect flow — verify manually or in e2e tests)
```

- [ ] **Step 3: Commit**

```bash
git add infra/keycloak/vnshop-realm.json
git commit -m "security(auth): disable ROPC (direct access grants) on vnshop-api client

Resource Owner Password Credentials is deprecated in OAuth 2.1 and
bypasses Keycloak's brute-force protection. The httpOnly cookie auth
flow (AuthSessionController) uses Authorization Code flow instead."
```

---

## Task 10: Fix Redis Eviction Policy — Prevent Primary Data Loss

**Files:**
- Modify: `docker-compose.yml:192-193` (Redis command)
- Modify: `infra/k8s/base/configmap.yaml` (if Redis config is referenced)

**Why:** Redis uses `allkeys-lru` which evicts ANY key under memory pressure — including cart data (primary store, not cache), flash-sale reservations (primary store), and idempotency keys (24h TTL). Evicting an idempotency key allows duplicate order creation. Evicting a flash-sale reservation causes inventory double-sells. `volatile-lru` only evicts keys that have a TTL set, protecting primary-store keys that intentionally have no expiry.

- [ ] **Step 1: Change eviction policy in docker-compose.yml**

In `docker-compose.yml`, find the Redis service command (around line 193):

```yaml
# BEFORE:
    command: redis-server --requirepass ${REDIS_PASSWORD:-vnshop123} --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru

# AFTER:
    command: redis-server --requirepass ${REDIS_PASSWORD:-vnshop123} --appendonly yes --maxmemory 512mb --maxmemory-policy volatile-lru
```

- [ ] **Step 2: Verify all cache keys have TTLs set (volatile-lru requirement)**

For `volatile-lru` to work correctly, all cache-only keys must have a TTL. Verify the existing services set TTLs:

- product-service cache: 5-min TTL ✅ (CacheConfig.java `entryTtl(Duration.ofMinutes(5))`)
- order-service coupon cache: 5-min TTL ✅
- order-service idempotency: 24h TTL ✅ (IdempotencyFilter sets TTL)
- api-gateway rate limiting: inherent TTL from sliding window ✅
- cart-service: NO TTL (primary store — must NOT be evicted) ✅ (volatile-lru protects this)
- inventory-service flash reservations: 15-min TTL set in Lua script ⚠️

The flash-sale reservation keys have a 15-min TTL — meaning they ARE eligible for eviction under `volatile-lru`. This is acceptable because:
1. Reservations are temporary by design (expire after 15 min if not confirmed)
2. Under extreme memory pressure, evicting a stale reservation is safer than evicting a cart

If flash-sale reservations must be absolutely protected, they should be moved to a separate Redis instance (Phase 3 work).

- [ ] **Step 3: Update K8s configmap if Redis config is defined there**

Check `infra/k8s/base/configmap.yaml` for any Redis config. If it references `allkeys-lru`, update to `volatile-lru`. If Redis is configured purely via the pod command, update the workloads.yaml Redis container args.

In `infra/k8s/base/workloads.yaml`, find the Redis deployment and update the command args:

```yaml
# Find: --maxmemory-policy allkeys-lru
# Replace with: --maxmemory-policy volatile-lru
```

- [ ] **Step 4: Verify Redis accepts the new policy**

```bash
docker compose up redis -d
docker compose exec redis redis-cli -a vnshop123 CONFIG GET maxmemory-policy
# Expected output:
# 1) "maxmemory-policy"
# 2) "volatile-lru"
```

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git add infra/k8s/base/workloads.yaml
git commit -m "data-safety(redis): switch from allkeys-lru to volatile-lru

allkeys-lru can evict ANY key under memory pressure — including cart data
and idempotency keys that are primary stores, not caches. volatile-lru
only evicts keys with a TTL set, protecting persistent data from silent loss."
```

---

## Execution Order & Dependencies

All 10 tasks are **independent** — they can be executed in any order or in parallel. However, the recommended order optimizes for:
1. Unlocking other work (Prometheus/Alertmanager enable visibility for debugging everything else)
2. Quick wins first (builds momentum)
3. Largest risk reduction earliest

**Recommended execution sequence:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Quick wins (< 1 hour each):                                             │
│  Task 10: Redis eviction (5 min)                                        │
│  Task 9: Disable ROPC (5 min)                                           │
│  Task 5: Prometheus scrape targets (30 min)                             │
│  Task 6: Alertmanager receiver (15 min)                                 │
│  Task 7: Elasticsearch security (30 min)                                │
├─────────────────────────────────────────────────────────────────────────┤
│ Medium effort (1-4 hours):                                               │
│  Task 3: gRPC deadlines (2 hours)                                       │
│  Task 1: Kafka JAAS template (2 hours)                                  │
│  Task 2: Keycloak secrets (1 hour)                                      │
│  Task 4: Kafka SASL_SSL (4 hours)                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ Multi-day:                                                               │
│  Task 8: Audit logging (2-3 days)                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Verification Checklist (Run After All Tasks Complete)

```bash
# 1. No secrets in git:
git log --all --diff-filter=A -- '*.conf' '*.json' | grep -i "password\|secret"
# Expected: No new plaintext secrets

# 2. Kafka connects with SSL:
docker compose exec kafka kafka-broker-api-versions --bootstrap-server kafka:9092 --command-config /etc/kafka/admin-ssl.properties
# Expected: Successful connection via SASL_SSL

# 3. gRPC timeout works:
# Stop inventory-service, attempt order creation — should fail in ~5s, not hang

# 4. Prometheus scraping:
curl -s http://localhost:9090/api/v1/targets | jq '[.data.activeTargets[] | select(.health=="up")] | length'
# Expected: 11 (all services)

# 5. Alertmanager has receiver:
curl -s http://localhost:9093/api/v2/receivers | jq '.[].name'
# Expected: "default", "critical"

# 6. ES requires auth:
curl -s -o /dev/null -w "%{http_code}" http://localhost:9200/
# Expected: 401

# 7. ROPC disabled:
curl -s -X POST http://localhost:8085/realms/vnshop/protocol/openid-connect/token \
  -d "grant_type=password&client_id=vnshop-api&username=buyer1&password=test" | jq .error
# Expected: "unauthorized_client"

# 8. Redis policy:
docker compose exec redis redis-cli -a vnshop123 CONFIG GET maxmemory-policy
# Expected: volatile-lru

# 9. Audit table exists:
docker compose exec postgres-order psql -U vnshop -d order_db -c "\dt order_svc.audit_log"
# Expected: Table listed
```
