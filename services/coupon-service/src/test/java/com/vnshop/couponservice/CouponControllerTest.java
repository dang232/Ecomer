package com.vnshop.couponservice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.couponservice.infrastructure.persistence.CouponJpaEntity;
import com.vnshop.couponservice.infrastructure.persistence.CouponJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * MockMvc-based controller test. The previous incarnation used {@link
 * org.springframework.boot.resttestclient.TestRestTemplate} which fails to construct under this
 * service's Spring Boot 4 dependency closure (missing
 * {@code org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder}). MockMvc routes
 * the calls through the dispatcher servlet without an HTTP client, so the test class loads
 * regardless of which ClientHttpRequestFactoryBuilder variant is on the classpath.
 */
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@WithMockUser(roles = "ADMIN")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:coupon_service;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;INIT=CREATE SCHEMA IF NOT EXISTS coupon_svc",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=http://localhost:8085/realms/vnshop",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.security.oauth2.resource.servlet.OAuth2ResourceServerAutoConfiguration"
})
class CouponControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CouponJpaRepository couponRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void deleteCoupons() {
        couponRepository.deleteAll();
    }

    @Test
    void createCoupon() throws Exception {
        MvcResult result = mockMvc.perform(post("/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validCouponRequest("SAVE10"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.code").value("SAVE10"))
                .andExpect(jsonPath("$.data.type").value("PERCENTAGE"))
                .andReturn();

        assertThat(result.getResponse().getContentAsString()).contains("\"code\":\"SAVE10\"");
        assertThat(couponRepository.findByCode("SAVE10")).isPresent();
    }

    @Test
    void listActiveCoupons() throws Exception {
        mockMvc.perform(post("/coupons")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(validCouponRequest("LIST10"))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/coupons"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[?(@.code=='LIST10')]").exists());
    }

    @Test
    void listActiveCouponsExcludesExpiredCoupons() throws Exception {
        mockMvc.perform(post("/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                couponRequest("EXPIRED-LIST", Instant.now().minusSeconds(60),
                                        BigDecimal.ZERO, 100))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/coupons"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.code=='EXPIRED-LIST')]").doesNotExist());
    }

    @Test
    void validateCouponReturnsDiscountForValidCoupon() throws Exception {
        mockMvc.perform(post("/coupons")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(validCouponRequest("VALID10"))))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/coupons/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("code", "VALID10", "orderAmount", BigDecimal.valueOf(200)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.valid").value(true))
                .andExpect(jsonPath("$.data.discount").value(20.0))
                .andExpect(jsonPath("$.data.message").value("Coupon is valid"));
    }

    @Test
    void validateCouponRejectsExpiredCoupon() throws Exception {
        mockMvc.perform(post("/coupons")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        couponRequest("EXPIRED10", Instant.now().minusSeconds(60), BigDecimal.valueOf(100), 100))))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/coupons/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("code", "EXPIRED10", "orderAmount", BigDecimal.valueOf(200)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.valid").value(false))
                .andExpect(jsonPath("$.data.message").value("Coupon is expired"));
    }

    @Test
    void validateCouponRejectsInsufficientOrderAmount() throws Exception {
        mockMvc.perform(post("/coupons")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(validCouponRequest("MIN10"))))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/coupons/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("code", "MIN10", "orderAmount", BigDecimal.valueOf(50)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.valid").value(false))
                .andExpect(jsonPath("$.data.message").value("Order amount is below minimum"));
    }

    /**
     * Issue 2 fix path: a successful apply increments currentUses and returns the response
     * DTO with discount + finalTotal. We seed maxUses=1 so this consume takes the only seat.
     */
    @Test
    void applyCouponSucceedsWhenSeatAvailable() throws Exception {
        mockMvc.perform(post("/coupons")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        couponRequest("APPLY-OK", Instant.now().plusSeconds(3600), BigDecimal.valueOf(100), 1))))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/checkout/apply-coupon")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("code", "APPLY-OK", "orderAmount", BigDecimal.valueOf(200), "userId", "test-user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code").value("APPLY-OK"))
                .andExpect(jsonPath("$.data.discount").value(20.0))
                .andExpect(jsonPath("$.data.finalTotal").value(180.0));

        CouponJpaEntity stored = couponRepository.findByCode("APPLY-OK").orElseThrow();
        assertThat(stored.getCurrentUses()).isEqualTo(1);
    }

    /**
     * Issue 2 fix path: when a coupon is fully consumed the conditional UPDATE returns 0
     * and we surface 422 with the {@code COUPON_EXHAUSTED} marker. We pre-saturate
     * currentUses directly through the repository to drive the test deterministically.
     */
    @Test
    void applyCouponReturns422WhenExhausted() throws Exception {
        mockMvc.perform(post("/coupons")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        couponRequest("APPLY-FULL", Instant.now().plusSeconds(3600), BigDecimal.valueOf(100), 1))))
                .andExpect(status().isCreated());
        CouponJpaEntity coupon = couponRepository.findByCode("APPLY-FULL").orElseThrow();
        coupon.setCurrentUses(coupon.getMaxUses());
        couponRepository.save(coupon);

        MvcResult result = mockMvc.perform(post("/checkout/apply-coupon")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("code", "APPLY-FULL", "orderAmount", BigDecimal.valueOf(200), "userId", "test-user-2"))))
                .andExpect(status().isUnprocessableEntity())
                .andReturn();

        // The exception's reason carries the COUPON_EXHAUSTED marker; ResponseStatusException
        // surfaces it via the body or the underlying response error message.
        String body = result.getResponse().getContentAsString();
        String reason = result.getResponse().getErrorMessage();
        assertThat(body + " | " + reason).contains("COUPON_EXHAUSTED");
        assertThat(couponRepository.findByCode("APPLY-FULL").orElseThrow().getCurrentUses())
                .isEqualTo(coupon.getMaxUses());
    }

    /**
     * Issue 2 race-condition reproducer: with maxUses=1, two direct calls to
     * {@code tryConsumeUsage} from a single thread serialize through the DB. The first
     * returns 1 (won the seat), the second returns 0 (exhausted). This is the same
     * predicate two concurrent applies would race against — the conditional UPDATE is the
     * synchronization point, so even if the predicate evaluation order interleaves,
     * exactly one caller sees a successful update.
     */
    @Test
    void tryConsumeUsageIsAtomicAtTheRowLevel() throws Exception {
        mockMvc.perform(post("/coupons")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        couponRequest("RACE-1", Instant.now().plusSeconds(3600), BigDecimal.valueOf(100), 1))))
                .andExpect(status().isCreated());
        Long id = couponRepository.findByCode("RACE-1").orElseThrow().getId();

        int firstAttempt = couponRepository.tryConsumeUsage(id);
        int secondAttempt = couponRepository.tryConsumeUsage(id);

        assertThat(firstAttempt).isEqualTo(1);
        assertThat(secondAttempt).isEqualTo(0);
        assertThat(couponRepository.findByCode("RACE-1").orElseThrow().getCurrentUses()).isEqualTo(1);
    }

    private Map<String, Object> validCouponRequest(String code) {
        return couponRequest(code, Instant.now().plusSeconds(3600), BigDecimal.valueOf(100), 100);
    }

    private Map<String, Object> couponRequest(String code, Instant validUntil, BigDecimal minOrderValue, int maxUses) {
        Map<String, Object> body = new HashMap<>();
        body.put("code", code);
        body.put("type", "PERCENTAGE");
        body.put("value", BigDecimal.valueOf(10));
        body.put("minOrderValue", minOrderValue);
        body.put("maxDiscount", BigDecimal.valueOf(50));
        body.put("maxUses", maxUses);
        body.put("validUntil", validUntil.toString());
        return body;
    }
}
