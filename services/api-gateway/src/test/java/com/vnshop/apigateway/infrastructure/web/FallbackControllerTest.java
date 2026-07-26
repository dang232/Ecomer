package com.vnshop.apigateway.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class FallbackControllerTest {

    private final FallbackController controller = new FallbackController();

    @Test
    void returns503WithErrorEnvelopeSoTheBodyAndStatusAgree() {
        ResponseEntity<ApiResponse<Map<String, Object>>> response =
            controller.fallback("user-service");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).isNotNull();
        // ponytail: the FE's response interceptor trusts the envelope — a
        // success:true body with a 503 status renders "Success" to the user.
        assertThat(response.getBody().success()).isFalse();
        assertThat(response.getBody().errorCode()).isEqualTo("SERVICE_UNAVAILABLE");
        assertThat(response.getBody().message()).isEqualTo("Service temporarily unavailable");
    }
}