package com.vnshop.paymentservice.infrastructure.order;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.domain.OrderSnapshot;
import com.vnshop.paymentservice.domain.port.out.OrderCatalogPort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * Reads canonical order details from order-service over HTTP. Forwards the
 * caller's JWT so order-service's standard authorization recognises the
 * request as belonging to the buyer.
 *
 * <p>Connect/read timeouts cap the worst-case checkout latency. 404 maps
 * to an empty Optional (legitimate "order not found"); other HTTP errors
 * or transport failures bubble as {@link OrderCatalogUnavailableException}
 * which the controller advice maps to 503. We don't wrap a circuit breaker
 * around the call here — payment-service doesn't have resilience4j on
 * classpath, and a per-checkout call latency budget bounded by the read
 * timeout is enough to keep the gateway from hanging on a slow order
 * lookup. Add resilience4j later if outages become a recurring problem.
 */
@Component
public class OrderCatalogAdapter implements OrderCatalogPort {

    private final OrderHttpClient orderHttpClient;
    private final ObjectMapper objectMapper;

    public OrderCatalogAdapter(OrderHttpClient orderHttpClient, ObjectMapper objectMapper) {
        this.orderHttpClient = orderHttpClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public Optional<OrderSnapshot> findByOrderId(String orderId) {
        String authHeader = currentBearerToken().map(t -> "Bearer " + t).orElse(null);
        try {
            String json = orderHttpClient.getOrder(orderId, authHeader);
            if (json == null || json.isBlank()) {
                return Optional.empty();
            }
            ApiResponseDto wrapper = objectMapper.readValue(json, ApiResponseDto.class);
            if (wrapper == null || wrapper.data == null) {
                return Optional.empty();
            }
            return Optional.of(toDomain(wrapper.data));
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 404) {
                return Optional.empty();
            }
            throw new OrderCatalogUnavailableException(
                    "order-service returned " + e.getStatusCode() + ": " + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new OrderCatalogUnavailableException(
                    "order-service unreachable or timed out: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new OrderCatalogUnavailableException("failed to read order-service response: " + e.getMessage(), e);
        }
    }

    /**
     * Forward the caller's JWT to order-service so it can resolve the buyer
     * principal the same way it does for any FE-originated request. Returns
     * empty when called outside an authenticated request context (e.g.
     * background jobs) — the caller of {@link #findByOrderId} must handle
     * the resulting authorization failure.
     */
    private static Optional<String> currentBearerToken() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            return Optional.empty();
        }
        return Optional.ofNullable(jwt.getTokenValue());
    }

    private static OrderSnapshot toDomain(OrderDataDto data) {
        BigDecimal amount = data.finalAmount == null || data.finalAmount.amount == null
                ? BigDecimal.ZERO
                : data.finalAmount.amount;
        String currency = data.finalAmount == null || data.finalAmount.currency == null
                ? "VND"
                : data.finalAmount.currency;
        return new OrderSnapshot(data.id, data.buyerId, amount, currency, data.paymentStatus);
    }

    // --- DTOs mirroring order-service ApiResponse<OrderResponse> ---

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class ApiResponseDto {
        @JsonProperty("data")
        public OrderDataDto data;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class OrderDataDto {
        @JsonProperty("id")
        public String id;

        @JsonProperty("buyerId")
        public String buyerId;

        @JsonProperty("finalAmount")
        public MoneyDto finalAmount;

        @JsonProperty("paymentStatus")
        public String paymentStatus;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class MoneyDto {
        @JsonProperty("amount")
        public BigDecimal amount;

        @JsonProperty("currency")
        public String currency;
    }
}
