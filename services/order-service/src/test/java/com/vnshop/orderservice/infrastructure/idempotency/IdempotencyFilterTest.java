package com.vnshop.orderservice.infrastructure.idempotency;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IdempotencyFilterTest {
    @org.junit.jupiter.api.AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void claimsWithPrincipalAndRouteScopedKeyAndReturnsRequestIdHeader() throws Exception {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.get(any())).thenReturn(null);
        when(values.setIfAbsent(any(), any(), any(Duration.class))).thenReturn(true);

        IdempotencyFilter filter = new IdempotencyFilter(redis, new ObjectMapper(), Duration.ofHours(1), new SimpleMeterRegistry());
        MockHttpServletRequest request = request("same-key", "{\"amount\":100}");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThat(filter.preHandle(request, response, new Object())).isTrue();
        assertThat(response.getHeader("X-Request-ID")).isEqualTo(request.getAttribute(IdempotencyFilter.class.getName() + ".requestId"));
        verify(values).setIfAbsent(eq(redisKey("anonymous", "/orders", "same-key")), any(), eq(Duration.ofHours(1)));
    }

    @Test
    void sameKeyDifferentBodyReturnsConflictBecauseHashIsStoredAlongsideKey() throws Exception {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        String cached = "{\"processing\":false,\"bodyHash\":\"different\",\"ownerToken\":null,\"status\":200,\"body\":\"{}\"}";
        when(values.get(any())).thenReturn(cached);

        SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
        IdempotencyFilter filter = new IdempotencyFilter(redis, new ObjectMapper(), Duration.ofHours(1), meterRegistry);
        MockHttpServletRequest request = request("same-key", "{\"amount\":101}");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThat(filter.preHandle(request, response, new Object())).isFalse();
        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_CONFLICT);
        assertThat(meterRegistry.get("idempotency_failures_total").tag("reason", "body_conflict").counter().count()).isEqualTo(1);
    }

    @Test
    void samePrincipalAndKeyOnDifferentRoutesDoNotReplay() throws Exception {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.get(any())).thenReturn(null);
        when(values.setIfAbsent(any(), any(), any(Duration.class))).thenReturn(true);
        IdempotencyFilter filter = new IdempotencyFilter(redis, new ObjectMapper(), Duration.ofHours(1), new SimpleMeterRegistry());

        MockHttpServletRequest first = request("same-key", "{}", "/orders");
        MockHttpServletResponse firstResponse = new MockHttpServletResponse();
        assertThat(filter.preHandle(first, firstResponse, new Object())).isTrue();

        MockHttpServletRequest second = request("same-key", "{}", "/checkout");
        MockHttpServletResponse secondResponse = new MockHttpServletResponse();
        assertThat(filter.preHandle(second, secondResponse, new Object())).isTrue();

        verify(values).setIfAbsent(eq(redisKey("anonymous", "/orders", "same-key")), any(), eq(Duration.ofHours(1)));
        verify(values).setIfAbsent(eq(redisKey("anonymous", "/checkout", "same-key")), any(), eq(Duration.ofHours(1)));
    }

    @Test
    void differentPrincipalsDoNotReplaySameKey() throws Exception {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.get(any())).thenReturn(null);
        when(values.setIfAbsent(any(), any(), any(Duration.class))).thenReturn(true);
        IdempotencyFilter filter = new IdempotencyFilter(redis, new ObjectMapper(), Duration.ofHours(1), new SimpleMeterRegistry());

        TestingAuthenticationToken buyerA = new TestingAuthenticationToken("buyer-a", null, "ROLE_BUYER");
        buyerA.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(buyerA);
        assertThat(filter.preHandle(request("same-key", "{}"), new MockHttpServletResponse(), new Object())).isTrue();
        TestingAuthenticationToken buyerB = new TestingAuthenticationToken("buyer-b", null, "ROLE_BUYER");
        buyerB.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(buyerB);
        assertThat(filter.preHandle(request("same-key", "{}"), new MockHttpServletResponse(), new Object())).isTrue();

        verify(values).setIfAbsent(eq(redisKey("buyer-a", "/orders", "same-key")), any(), eq(Duration.ofHours(1)));
        verify(values).setIfAbsent(eq(redisKey("buyer-b", "/orders", "same-key")), any(), eq(Duration.ofHours(1)));
    }

    @Test
    void processingReturns425AndRetryAfter() throws Exception {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.get(any())).thenReturn("{\"processing\":true,\"bodyHash\":\"44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a\",\"ownerToken\":\"owner\",\"status\":0,\"body\":\"\"}");

        IdempotencyFilter filter = new IdempotencyFilter(redis, new ObjectMapper(), Duration.ofHours(1), new SimpleMeterRegistry());
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertThat(filter.preHandle(request("same-key", "{}"), response, new Object())).isFalse();
        assertThat(response.getStatus()).isEqualTo(425);
        assertThat(response.getHeader("Retry-After")).isEqualTo("1");
    }

    @Test
    void redisFailureReturns503AndFailureMetric() throws Exception {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.get(any())).thenThrow(new org.springframework.data.redis.RedisSystemException("redis down", new IllegalStateException("connection refused")));
        SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
        IdempotencyFilter filter = new IdempotencyFilter(redis, new ObjectMapper(), Duration.ofHours(1), meterRegistry);
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThat(filter.preHandle(request("same-key", "{}"), response, new Object())).isFalse();
        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
        assertThat(meterRegistry.get("idempotency_failures_total").tag("reason", "redis").counter().count()).isEqualTo(1);
    }

    @Test
    void missingIdempotencyKeyPassesThroughButStillPublishesRequestId() throws Exception {
        IdempotencyFilter filter = new IdempotencyFilter(mock(StringRedisTemplate.class), new ObjectMapper(), Duration.ofHours(1), new SimpleMeterRegistry());
        MockHttpServletRequest request = request(null, "");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThat(filter.preHandle(request, response, new Object())).isTrue();
        assertThat(response.getHeader("X-Request-ID")).isNotBlank();
    }

    private static MockHttpServletRequest request(String key, String body) {
        return request(key, body, "/orders");
    }

    private static MockHttpServletRequest request(String key, String body, String path) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        if (key != null) request.addHeader("Idempotency-Key", key);
        request.setContent(body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return request;
    }

    private static String redisKey(String principal, String route, String key) {
        return "idempotency:" + sha256(principal + "|" + route + "|" + key);
    }

    private static String sha256(byte[] value) {
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(value));
        } catch (java.security.NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static String sha256(String value) {
        return sha256(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
