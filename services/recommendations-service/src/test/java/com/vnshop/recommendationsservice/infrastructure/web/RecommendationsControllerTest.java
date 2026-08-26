package com.vnshop.recommendationsservice.infrastructure.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vnshop.recommendationsservice.application.FrequentlyBoughtTogetherUseCase;
import com.vnshop.recommendationsservice.application.ProductProjection;
import com.vnshop.recommendationsservice.application.ProductServicePort;
import com.vnshop.recommendationsservice.application.YouMayAlsoLikeUseCase;
import com.vnshop.recommendationsservice.infrastructure.persistence.CoPurchaseRepository;
import com.vnshop.recommendationsservice.infrastructure.persistence.ProcessedOrderRepository;
import com.vnshop.recommendationsservice.infrastructure.dlt.DurableDltRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * MockMvc-based controller test. Mirrors the Spring Boot 4 idiom used by
 * coupon-service ({@code services/coupon-service/.../CouponControllerTest}).
 * The DataSource / JPA / Flyway / Kafka autoconfigurations are excluded because
 * the controller path doesn't need them and pulling them up requires Postgres.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.autoconfigure.exclude="
                + "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,"
                + "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration,"
                + "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration,"
                + "org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration",
        "vnshop.kafka.admin.enabled=false",
        // Disables the @ConditionalOnProperty-gated OrderEventListener so it does
        // not need a Kafka cluster (or its dependencies) to wire in this test.
        "vnshop.recommendations.events.enabled=false"
})
class RecommendationsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FrequentlyBoughtTogetherUseCase frequentlyBoughtTogetherUseCase;

    @MockitoBean
    private YouMayAlsoLikeUseCase youMayAlsoLikeUseCase;

    @MockitoBean
    private CoPurchaseRepository coPurchaseRepository;

    @MockitoBean
    private ProcessedOrderRepository processedOrderRepository;

    @MockitoBean
    private ProductServicePort productServicePort;

    @MockitoBean
    private DurableDltRepository durableDltRepository;

    @MockitoBean
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Test
    void frequentlyBoughtTogetherReturnsItems() throws Exception {
        when(frequentlyBoughtTogetherUseCase.findFor(eq("p-1"), eq(4)))
                .thenReturn(List.of(projection("p-2"), projection("p-3")));

        mockMvc.perform(get("/recommendations/frequently-bought-together")
                        .param("productId", "p-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value("p-2"))
                .andExpect(jsonPath("$.data[1].id").value("p-3"))
                .andExpect(jsonPath("$.data[0].price").value(100));
    }

    @Test
    void frequentlyBoughtTogetherHonoursLimit() throws Exception {
        when(frequentlyBoughtTogetherUseCase.findFor(eq("p-1"), eq(2)))
                .thenReturn(List.of(projection("p-2")));

        mockMvc.perform(get("/recommendations/frequently-bought-together")
                        .param("productId", "p-1")
                        .param("limit", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    void frequentlyBoughtTogetherClampsLimitToCeiling() throws Exception {
        // limit > 24 should be rejected by validation (Bean Validation @Max(24)).
        mockMvc.perform(get("/recommendations/frequently-bought-together")
                        .param("productId", "p-1")
                        .param("limit", "9999"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void frequentlyBoughtTogetherRejectsBlankProductId() throws Exception {
        mockMvc.perform(get("/recommendations/frequently-bought-together")
                        .param("productId", "  "))
                .andExpect(status().isBadRequest());
    }

    @Test
    void frequentlyBoughtTogetherRequiresProductId() throws Exception {
        mockMvc.perform(get("/recommendations/frequently-bought-together"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void youMayAlsoLikeReturnsItems() throws Exception {
        when(youMayAlsoLikeUseCase.findFor(eq("p-1"), eq(8)))
                .thenReturn(List.of(projection("p-9")));

        mockMvc.perform(get("/recommendations/you-may-also-like")
                        .param("productId", "p-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value("p-9"))
                .andExpect(jsonPath("$.data[0].category").value("cat"));
    }

    @Test
    void youMayAlsoLikeHonoursLimit() throws Exception {
        when(youMayAlsoLikeUseCase.findFor(eq("p-1"), eq(3)))
                .thenReturn(List.of(projection("p-9")));

        mockMvc.perform(get("/recommendations/you-may-also-like")
                        .param("productId", "p-1")
                        .param("limit", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    void youMayAlsoLikeRejectsZeroLimit() throws Exception {
        mockMvc.perform(get("/recommendations/you-may-also-like")
                        .param("productId", "p-1")
                        .param("limit", "0"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void useCaseIllegalArgumentSurfacesAsBadRequest() throws Exception {
        when(frequentlyBoughtTogetherUseCase.findFor(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyInt()))
                .thenThrow(new IllegalArgumentException("nope"));

        mockMvc.perform(get("/recommendations/frequently-bought-together")
                        .param("productId", "p-1"))
                .andExpect(status().isBadRequest());
    }

    private static ProductProjection projection(String id) {
        return new ProductProjection(id, "seller", "name-" + id, "cat", "img-" + id,
                new BigDecimal("100"), new BigDecimal("120"), 5, 4.5, 50, List.of("img-" + id));
    }
}
