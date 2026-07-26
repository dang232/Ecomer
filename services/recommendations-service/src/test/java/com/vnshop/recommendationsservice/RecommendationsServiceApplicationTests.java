package com.vnshop.recommendationsservice;

import com.vnshop.recommendationsservice.application.CoPurchaseAggregator;
import com.vnshop.recommendationsservice.application.ProductServicePort;
import com.vnshop.recommendationsservice.infrastructure.persistence.CoPurchaseRepository;
import com.vnshop.recommendationsservice.infrastructure.persistence.ProcessedOrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Smoke test for the application context. Excludes JPA / Flyway / Kafka
 * autoconfig per the monorepo gotcha; mocks every Spring Data repository
 * and bean that would otherwise need an EntityManagerFactory wired up.
 */
@SpringBootTest(properties = {
        "spring.autoconfigure.exclude="
                + "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,"
                + "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration,"
                + "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration,"
                + "org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration",
        "vnshop.kafka.admin.enabled=false",
        // Disables the Kafka listener so the smoke test doesn't need a broker.
        "vnshop.recommendations.events.enabled=false"
})
class RecommendationsServiceApplicationTests {

    @MockitoBean
    private CoPurchaseRepository coPurchaseRepository;

    @MockitoBean
    private ProcessedOrderRepository processedOrderRepository;

    @MockitoBean
    private CoPurchaseAggregator coPurchaseAggregator;

    @MockitoBean
    private ProductServicePort productServicePort;

    @Test
    void contextLoads() {
    }
}
