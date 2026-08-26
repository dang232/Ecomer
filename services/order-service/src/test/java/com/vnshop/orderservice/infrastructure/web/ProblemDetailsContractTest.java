package com.vnshop.orderservice.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

class ProblemDetailsContractTest {
    @Test
    void exposesRequiredRfc7807Fields() {
        ProblemDetails response = ProblemDetails.of(
                "validation-error", "Validation failed", 422, "invalid request", "/orders", "VALIDATION_ERROR",
                "req-1", "trace-1", false, Map.of("address", java.util.List.of("must not be null")));

        assertThat(response.type()).isEqualTo("validation-error");
        assertThat(response.title()).isEqualTo("Validation failed");
        assertThat(response.status()).isEqualTo(422);
        assertThat(response.detail()).isEqualTo("invalid request");
        assertThat(response.instance()).isEqualTo("/orders");
        assertThat(response.code()).isEqualTo("VALIDATION_ERROR");
        assertThat(response.requestId()).isEqualTo("req-1");
        assertThat(response.traceId()).isEqualTo("trace-1");
        assertThat(response.retryable()).isFalse();
        assertThat(response.fields()).containsKey("address");
    }
}
