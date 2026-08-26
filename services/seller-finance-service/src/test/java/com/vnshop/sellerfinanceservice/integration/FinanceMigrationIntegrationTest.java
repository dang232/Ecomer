package com.vnshop.sellerfinanceservice.integration;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = "vnshop.admin-cursor.secret=test-secret")
@Testcontainers
@Import(TestcontainersConfig.class)
class FinanceMigrationIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // Replace the auto-configured JwtDecoder (which would otherwise probe the
    // real Keycloak issuer-uri during SecurityConfig wiring) with a Mockito
    // stub so context-load passes without a live Keycloak instance.
    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void appliesFlywayMigrationsThroughDurableDltVersion() {
        String version = jdbcTemplate.queryForObject(
            "select version from seller_finance_svc.flyway_schema_history where success order by installed_rank desc limit 1",
            String.class
        );

        assertThat(version).isEqualTo("13");
    }
}
