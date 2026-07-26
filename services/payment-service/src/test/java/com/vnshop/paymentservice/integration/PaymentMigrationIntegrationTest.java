package com.vnshop.paymentservice.integration;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {
    "vnshop.kafka.admin.enabled=false",
    "payment.kafka.listeners.enabled=false",
    "spring.autoconfigure.exclude=org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration"
})
@Testcontainers
@Import(TestcontainersConfig.class)
class PaymentMigrationIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void appliesFlywayMigrationsAndCreatesFinancialOutboxAuditColumn() {
        String version = jdbcTemplate.queryForObject(
            "select version from payment_svc.flyway_schema_history where success order by installed_rank desc limit 1",
            String.class
        );

        assertThat(version).isEqualTo("19");

        Integer matchingColumns = jdbcTemplate.queryForObject(
            "select count(*) from information_schema.columns "
                + "where table_schema = 'payment_svc' "
                + "and table_name = 'financial_event_outbox' "
                + "and column_name in ('created_at', 'updated_at')",
            Integer.class
        );

        assertThat(matchingColumns).isEqualTo(2);
    }
}
