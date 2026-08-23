package com.vnshop.paymentservice.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackEventStore;
import com.vnshop.paymentservice.infrastructure.persistence.PendingWebhookSpringDataRepository;

import java.util.UUID;
import java.util.List;
import java.util.Map;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

@SpringBootTest(properties = {
    "vnshop.kafka.admin.enabled=false",
    "payment.kafka.listeners.enabled=false",
    "spring.autoconfigure.exclude=org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration",
    "grpc.server.auth.token=test-grpc-token"
})
@Testcontainers
@Import(TestcontainersConfig.class)
class PaymentMigrationIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PaymentCallbackEventStore callbackEvents;

    @Autowired
    private PendingWebhookSpringDataRepository pendingWebhooks;

    @Test
    void appliesFlywayMigrationsAndCreatesPaymentCallbackEventEvidence() {
        String version = jdbcTemplate.queryForObject(
            "select version from payment_svc.flyway_schema_history where success order by installed_rank desc limit 1",
            String.class
        );

        assertThat(version).isEqualTo("22");

        Integer matchingColumns = jdbcTemplate.queryForObject(
            "select count(*) from information_schema.columns "
                + "where table_schema = 'payment_svc' "
                + "and table_name = 'financial_event_outbox' "
                + "and column_name in ('created_at', 'updated_at')",
            Integer.class
        );

        assertThat(matchingColumns).isEqualTo(2);

        Integer callbackEventTable = jdbcTemplate.queryForObject(
            "select count(*) from information_schema.tables "
                + "where table_schema = 'payment_svc' and table_name = 'payment_callback_events'",
            Integer.class
        );

        assertThat(callbackEventTable).isEqualTo(1);

        Integer pendingWebhookIdentityIndex = jdbcTemplate.queryForObject(
            "select count(*) from pg_indexes "
                + "where schemaname = 'payment_svc' "
                + "and tablename = 'pending_webhooks' "
                + "and indexname = 'uq_pending_webhooks_webhook_provider'",
            Integer.class
        );

        assertThat(pendingWebhookIdentityIndex).isEqualTo(1);
    }

    @Test
    void appendsEachCallbackStatusOnceAndRejectsEventMutation() throws Exception {
        UUID paymentId = UUID.randomUUID();
        String correlationKey = "paypal:capture:" + paymentId;
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            List<Future<?>> appends = List.of(
                workers.submit(() -> callbackEvents.append("PAYPAL", paymentId, correlationKey, "RECEIVED")),
                workers.submit(() -> callbackEvents.append("PAYPAL", paymentId, correlationKey, "RECEIVED"))
            );
            for (Future<?> append : appends) {
                append.get(5, TimeUnit.SECONDS);
            }
        } finally {
            workers.shutdown();
            assertThat(workers.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        }
        callbackEvents.append("PAYPAL", paymentId, correlationKey, "PROCESSED");
        callbackEvents.append("PAYPAL", paymentId, correlationKey, "PROCESSED");

        Integer events = jdbcTemplate.queryForObject(
            "select count(*) from payment_svc.payment_callback_events where payment_id = ? and correlation_key = ?",
            Integer.class,
            paymentId,
            correlationKey
        );
        assertThat(events).isEqualTo(2);

        assertThatThrownBy(() -> jdbcTemplate.update(
                "update payment_svc.payment_callback_events set event_status = 'MUTATED' where payment_id = ?",
                paymentId))
            .isInstanceOf(RuntimeException.class);
    }

    @Test
    void reactivatesFailedWebhookWhenTheProviderRedeliversIt() {
        String eventId = "evt_reactivated";
        String provider = "STRIPE";
        assertThat(pendingWebhooks.insertIfAbsent(
                eventId, provider, "payment_intent.succeeded", "old-payload", Instant.now())).isEqualTo(1);
        jdbcTemplate.update("update payment_svc.pending_webhooks set status = 'FAILED', attempts = 3 "
                + "where webhook_id = ? and provider = ?", eventId, provider);

        assertThat(pendingWebhooks.insertIfAbsent(
                eventId, provider, "payment_intent.succeeded", "fresh-payload", Instant.now())).isEqualTo(1);

        Map<String, Object> row = jdbcTemplate.queryForMap(
                "select status, attempts, payload from payment_svc.pending_webhooks "
                        + "where webhook_id = ? and provider = ?", eventId, provider);
        assertThat(row).containsEntry("status", "PENDING")
                .containsEntry("attempts", 0)
                .containsEntry("payload", "fresh-payload");
    }
}
