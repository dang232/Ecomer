package com.vnshop.orderservice.infrastructure.idempotency;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.MethodParameter;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.opentelemetry.api.trace.Span;
import com.vnshop.orderservice.infrastructure.web.ProblemDetails;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Component
@ControllerAdvice
public class IdempotencyFilter implements HandlerInterceptor, ResponseBodyAdvice<Object> {
    private static final Logger log = LoggerFactory.getLogger(IdempotencyFilter.class);
    private static final String IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
    private static final String CACHE_KEY_PREFIX = "idempotency:";
    private static final String REQUEST_CACHE_KEY_ATTRIBUTE = IdempotencyFilter.class.getName() + ".cacheKey";
    private static final String REQUEST_CLAIM_ATTRIBUTE = IdempotencyFilter.class.getName() + ".claim";
    private static final String REQUEST_ID_ATTRIBUTE = IdempotencyFilter.class.getName() + ".requestId";
    private static final String PLACEHOLDER = "__PROCESSING__";
    private static final RedisScript<Long> RELEASE_CLAIM_SCRIPT = new DefaultRedisScript<>(
            "local current = redis.call('GET', KEYS[1]); "
                    + "if current == ARGV[1] then redis.call('DEL', KEYS[1]); return 1 end; return 0",
            Long.class);
    private static final RedisScript<Long> STORE_RESPONSE_SCRIPT = new DefaultRedisScript<>(
            "local current = redis.call('GET', KEYS[1]); "
                    + "if current == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3]); return 1 end; return 0",
            Long.class);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final Duration ttl;
    private final MeterRegistry meterRegistry;

    public IdempotencyFilter(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            @Value("${vnshop.idempotency.ttl:24h}") Duration ttl,
            MeterRegistry meterRegistry
    ) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.ttl = ttl;
        this.meterRegistry = meterRegistry;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        String requestId = requestId(request);
        request.setAttribute(REQUEST_ID_ATTRIBUTE, requestId);
        response.setHeader("X-Request-ID", requestId);
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String idempotencyKey = request.getHeader(IDEMPOTENCY_KEY_HEADER);
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return true;
        }

        try {
            String bodyHash = bodyHash(request);
            String scope = principal(request) + "|" + request.getRequestURI();
            String cacheKey = CACHE_KEY_PREFIX + sha256(scope + "|" + idempotencyKey);
            String claimToken = UUID.randomUUID().toString();
            String claim = objectMapper.writeValueAsString(CachedResponse.processing(bodyHash, claimToken));
            String cachedResponse = redisTemplate.opsForValue().get(cacheKey);
            if (cachedResponse != null) {
                if (PLACEHOLDER.equals(cachedResponse)) {
                    return processing(response, request);
                }
                CachedResponse cached = objectMapper.readValue(cachedResponse, CachedResponse.class);
                if (!bodyHash.equals(cached.bodyHash())) {
                    return conflict(response, request);
                }
                if (cached.processing()) {
                    return processing(response, request);
                }
                response.setStatus(cached.status());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.getWriter().write(cached.body());
                return false;
            }
            Boolean claimed = redisTemplate.opsForValue().setIfAbsent(cacheKey,
                    claim, ttl);
            if (!Boolean.TRUE.equals(claimed)) {
                String raced = redisTemplate.opsForValue().get(cacheKey);
                if (raced != null && !PLACEHOLDER.equals(raced)) {
                    CachedResponse existing = objectMapper.readValue(raced, CachedResponse.class);
                    return bodyHash.equals(existing.bodyHash())
                            ? (existing.processing() ? processing(response, request) : replay(existing, response))
                            : conflict(response, request);
                }
                return processing(response, request);
            }
            request.setAttribute(REQUEST_CACHE_KEY_ATTRIBUTE, cacheKey);
            request.setAttribute(REQUEST_CLAIM_ATTRIBUTE, claim);
        } catch (RedisConnectionFailureException | RedisSystemException | JsonProcessingException exception) {
            failure(request, exception);
            return unavailable(response, request);
        }
        return true;
    }

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(
            Object body,
            MethodParameter returnType,
            MediaType selectedContentType,
            Class<? extends HttpMessageConverter<?>> selectedConverterType,
            ServerHttpRequest request,
            ServerHttpResponse response
    ) {
        if (request instanceof ServletServerHttpRequest servletRequest) {
            Object cacheKey = servletRequest.getServletRequest().getAttribute(REQUEST_CACHE_KEY_ATTRIBUTE);
            Object claim = servletRequest.getServletRequest().getAttribute(REQUEST_CLAIM_ATTRIBUTE);
            if (cacheKey instanceof String key && claim instanceof String ownerClaim) {
                storeResponse(key, body, servletRequest.getServletRequest(), response);
            }
        }
        return body;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception exception) {
        Object cacheKey = request.getAttribute(REQUEST_CACHE_KEY_ATTRIBUTE);
        Object claim = request.getAttribute(REQUEST_CLAIM_ATTRIBUTE);
        if ((exception != null || response.getStatus() >= 400)
                && cacheKey instanceof String key && claim instanceof String ownerClaim) {
            releaseClaim(key, ownerClaim, request);
        }
    }

    private void storeResponse(String cacheKey, Object body, HttpServletRequest request, ServerHttpResponse response) {
        try {
            int status = response instanceof ServletServerHttpResponse servletResponse
                    ? servletResponse.getServletResponse().getStatus()
                    : 200;
            if (status >= 400) {
                releaseClaim(cacheKey, (String) request.getAttribute(REQUEST_CLAIM_ATTRIBUTE), request);
                return;
            }
            String responseBody = body instanceof String text ? text : objectMapper.writeValueAsString(body);
            String bodyHash = (String) request.getAttribute(REQUEST_CACHE_KEY_ATTRIBUTE + ".bodyHash");
            String ownerClaim = (String) request.getAttribute(REQUEST_CLAIM_ATTRIBUTE);
            String cachedResponse = objectMapper.writeValueAsString(new CachedResponse(false, bodyHash, null, status, responseBody));
            Long stored = redisTemplate.execute(STORE_RESPONSE_SCRIPT, List.of(cacheKey), ownerClaim, cachedResponse, String.valueOf(ttl.toMillis()));
            if (!Long.valueOf(1L).equals(stored)) {
                log.warn("idempotency-cache-store-lost-ownership traceId={} requestId={}", traceId(), requestId(request));
            }
        } catch (RedisConnectionFailureException | RedisSystemException | JsonProcessingException failure) {
            log.warn("idempotency-cache-store-failed traceId={} requestId={}", traceId(), requestId(request), failure);
            failureMetric("serialization_or_redis", request);
        }
    }

    private record CachedResponse(boolean processing, String bodyHash, String ownerToken, int status, String body) {
        static CachedResponse processing(String bodyHash, String ownerToken) { return new CachedResponse(true, bodyHash, ownerToken, 0, ""); }
    }

    private boolean replay(CachedResponse cached, HttpServletResponse response) throws IOException { response.setStatus(cached.status()); response.setContentType(MediaType.APPLICATION_JSON_VALUE); response.getWriter().write(cached.body()); meter("replayed"); return false; }
    private boolean conflict(HttpServletResponse response, HttpServletRequest request) throws IOException { writeProblem(response, 409, "IDEMPOTENCY_KEY_CONFLICT", "Idempotency-Key reused with a different request body", false, request); log.warn("idempotency-conflict requestId={} traceId={} route={}", requestId(request), traceId(), request.getRequestURI()); failureMetric("body_conflict", request); meter("conflict"); return false; }
    private boolean processing(HttpServletResponse response, HttpServletRequest request) throws IOException { writeProblem(response, 425, "IDEMPOTENCY_REQUEST_IN_PROGRESS", "Request is already being processed", true, request); log.info("idempotency-processing requestId={} traceId={} route={}", requestId(request), traceId(), request.getRequestURI()); failureMetric("processing", request); meter("processing"); return false; }
    private boolean unavailable(HttpServletResponse response, HttpServletRequest request) throws IOException { writeProblem(response, 503, "IDEMPOTENCY_STORE_UNAVAILABLE", "Idempotency store unavailable", true, request); return false; }
    private void writeProblem(HttpServletResponse response, int status, String code, String detail, boolean retryable, HttpServletRequest request) throws IOException {
        response.setStatus(status);
        response.setContentType("application/problem+json");
        if (retryable) response.setHeader("Retry-After", "1");
        String id = requestId(request);
        response.getWriter().write(objectMapper.writeValueAsString(new ProblemDetails(
                "https://api.vnshop.com/problems/" + code.toLowerCase(), "Request failed", status, detail,
                request.getRequestURI(), code, id, id, retryable, java.util.Map.of(), code)));
    }
    private void failure(HttpServletRequest request, Exception exception) { log.warn("idempotency-cache-failed traceId={} requestId={} operation={}", traceId(), requestId(request), request.getRequestURI(), exception); failureMetric("redis", request); meter("redis_error"); }
    private void failureMetric(String reason, HttpServletRequest request) { Counter.builder("idempotency_failures_total").description("Idempotency requests rejected or unavailable").tag("reason", reason).tag("route", request.getRequestURI()).register(meterRegistry).increment(); }
    private void meter(String outcome) { Counter.builder("idempotency_requests_total").tag("outcome", outcome).register(meterRegistry).increment(); }
    private static String principal(HttpServletRequest request) { Authentication auth = SecurityContextHolder.getContext().getAuthentication(); return auth == null || !auth.isAuthenticated() ? "anonymous" : auth.getName(); }
    private void releaseClaim(String cacheKey, String ownerClaim, HttpServletRequest request) {
        if (ownerClaim == null) {
            return;
        }
        try {
            redisTemplate.execute(RELEASE_CLAIM_SCRIPT, List.of(cacheKey), ownerClaim);
        } catch (RedisConnectionFailureException | RedisSystemException cleanupFailure) {
            log.warn("idempotency-cache-delete-failed traceId={} requestId={} operation={}", traceId(), requestId(request), request.getRequestURI(), cleanupFailure);
        }
    }
    private static String requestId(HttpServletRequest request) {
        Object attribute = request.getAttribute(REQUEST_ID_ATTRIBUTE);
        if (attribute instanceof String id && !id.isBlank()) {
            return id;
        }
        String id = request.getHeader("X-Request-ID");
        return id == null || id.isBlank() ? UUID.randomUUID().toString() : id;
    }
    private static String bodyHash(HttpServletRequest request) throws IOException {
        byte[] body = request.getInputStream().readAllBytes();
        String hash = sha256(body);
        request.setAttribute(REQUEST_CACHE_KEY_ATTRIBUTE + ".bodyHash", hash);
        return hash;
    }
    private static String sha256(String value) { return sha256(value.getBytes(StandardCharsets.UTF_8)); }
    private static String sha256(byte[] value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value)); } catch (NoSuchAlgorithmException ex) { throw new IllegalStateException("SHA-256 unavailable", ex); } }

    private static String traceId() {
        String id = Span.current().getSpanContext().getTraceId();
        return "0000000000000000".equals(id) ? "unknown" : id;
    }
}
