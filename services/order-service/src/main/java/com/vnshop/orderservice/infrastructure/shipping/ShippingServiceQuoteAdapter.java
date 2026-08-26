package com.vnshop.orderservice.infrastructure.shipping;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.vnshop.orderservice.application.shipping.ShippingOption;
import com.vnshop.orderservice.application.shipping.ShippingQuotePort;
import com.vnshop.orderservice.application.shipping.ShippingQuoteRequest;
import com.vnshop.orderservice.application.shipping.ShippingQuoteResult;
import com.vnshop.orderservice.domain.ParcelDimensions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Outbound adapter to shipping-service /shipping/rate-quotes. Mirrors the
 * pinned timeouts via JdkClientHttpRequestFactory. Transport and payload
 * failures are represented by the typed result contract; only an explicit
 * successful response with no options produces {@link ShippingQuoteResult.NoOptions}.
 *
 * <p>No circuit breaker here — the controller's degradation path already
 * rides on resilience4j at the gateway. Adding another breaker in-process
 * would double-count failures against the service-level budget.
 */
@Component
public class ShippingServiceQuoteAdapter implements ShippingQuotePort {

    private static final Logger LOG = LoggerFactory.getLogger(ShippingServiceQuoteAdapter.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final RestClient restClient;

    public ShippingServiceQuoteAdapter(
            @Value("${vnshop.shipping-service.uri:http://shipping-service:8093}") String shippingServiceUri,
            @Value("${vnshop.shipping-service.connect-timeout-ms:1000}") long connectTimeoutMs,
            @Value("${vnshop.shipping-service.read-timeout-ms:2500}") long readTimeoutMs) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(connectTimeoutMs))
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofMillis(readTimeoutMs));
        this.restClient = RestClient.builder()
                .baseUrl(shippingServiceUri)
                .requestFactory(factory)
                .build();
    }

    @Override
    public ShippingQuoteResult quote(ShippingQuoteRequest request) {
        String correlationId = correlationId();
        String parcelError = validateParcel(request);
        if (parcelError != null) {
            LOG.warn("shipping quote rejected correlationId={} reason={}", correlationId, parcelError);
            return new ShippingQuoteResult.InvalidParcelMetadata(parcelError);
        }

        try {
            Map<String, Object> body = buildRequestBody(request);
            String response = restClient.post()
                    .uri("/shipping/rate-quotes")
                    .header("X-Correlation-Id", correlationId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);
            if (response == null || response.isBlank()) {
                return dependencyUnavailable(correlationId, "shipping-service returned an empty response", null);
            }
            JsonNode options = MAPPER.readTree(response).path("data").path("options");
            if (!options.isArray()) {
                return dependencyUnavailable(correlationId, "shipping-service response omitted options", null);
            }
            if (options.isEmpty()) {
                LOG.info("shipping quote returned no options correlationId={}", correlationId);
                return new ShippingQuoteResult.NoOptions();
            }
            List<ShippingOption> out = new ArrayList<>();
            for (JsonNode option : options) {
                String serviceCode = option.path("serviceCode").asText("");
                long feeVnd = option.path("feeVnd").asLong(-1L);
                String eta = option.path("estimatedDeliveryTime").asText("");
                if (serviceCode.isBlank() || feeVnd < 0 || eta.isBlank()) {
                    return dependencyUnavailable(correlationId, "shipping-service returned invalid quote data", null);
                }
                out.add(new ShippingOption(serviceCode, BigDecimal.valueOf(feeVnd), eta));
            }
            LOG.info("shipping quote succeeded correlationId={} optionCount={}", correlationId, out.size());
            return new ShippingQuoteResult.Success(out);
        } catch (RestClientException | JsonProcessingException e) {
            return dependencyUnavailable(correlationId, "shipping-service rate quote failed", e);
        }
    }

    private static Map<String, Object> buildRequestBody(ShippingQuoteRequest request) {
        Map<String, Object> body = new HashMap<>();
        body.put("street", request.street());
        body.put("ward", request.ward());
        body.put("district", request.district());
        body.put("province", request.city());
        ParcelDimensions parcel = request.parcel();
        body.put("parcel", Map.of(
                "weightGrams", parcel.weightGrams(),
                "lengthCm", parcel.lengthCm(),
                "widthCm", parcel.widthCm(),
                "heightCm", parcel.heightCm(),
                "declaredValueMinor", parcel.declaredValueMinor()));
        return body;
    }

    private static String validateParcel(ShippingQuoteRequest request) {
        if (request == null || request.parcel() == null) {
            return "trusted parcel metadata is required";
        }
        ParcelDimensions parcel = request.parcel();
        if (parcel.weightGrams() <= 0 || parcel.lengthCm() <= 0 || parcel.widthCm() <= 0
                || parcel.heightCm() <= 0 || parcel.declaredValueMinor() < 0) {
            return "parcel weight, dimensions, and declared value must be valid";
        }
        return null;
    }

    private static ShippingQuoteResult.DependencyUnavailable dependencyUnavailable(
            String correlationId, String reason, Throwable cause) {
        if (cause == null) {
            LOG.warn("shipping quote dependency unavailable correlationId={} reason={}", correlationId, reason);
        } else {
            LOG.warn("shipping quote dependency unavailable correlationId={} reason={}", correlationId, reason, cause);
        }
        return new ShippingQuoteResult.DependencyUnavailable(reason);
    }

    private static String correlationId() {
        String mdcValue = MDC.get("correlationId");
        if (mdcValue != null && !mdcValue.isBlank()) {
            return mdcValue;
        }
        var attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletAttributes) {
            String value = servletAttributes.getRequest().getHeader("X-Correlation-Id");
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "unknown";
    }
}
