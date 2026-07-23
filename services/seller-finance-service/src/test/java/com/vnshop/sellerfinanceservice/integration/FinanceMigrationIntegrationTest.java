package com.vnshop.sellerfinanceservice.integration;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@Import(TestcontainersConfig.class)
class FinanceMigrationIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void appliesFlywayMigrationsThroughVersionSeven() {
        String version = jdbcTemplate.queryForObject(
            "select version from seller_finance_svc.flyway_schema_history where success order by installed_rank desc limit 1",
            String.class
        );

        assertThat(version).isEqualTo("7");
    }
}
