package com.vnshop.orderservice.infrastructure.product;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.catalog.CatalogProduct;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.ParcelDimensions;
import com.vnshop.orderservice.domain.port.out.ProductCatalogPort;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

/**
 * Reads canonical product details from product-service over HTTP. Used by
 * the checkout path to resolve light {@code (productId, variantSku?, quantity)}
 * line items into the full {@link com.vnshop.orderservice.domain.OrderItem}
 * shape the domain requires.
 *
 * <p>Behind a circuit breaker so a product-service outage degrades to a
 * checkout 503 rather than a hung thread pool. 404 is treated as
 * "product not found" (an empty {@link Optional}), not a CB-tripping
 * failure.
 */
@Component
public class ProductCatalogAdapter implements ProductCatalogPort {
    private static final String PRODUCT_BREAKER = "productServiceCircuitBreaker";

    private final ProductHttpClient productHttpClient;
    private final ObjectMapper objectMapper;
    private final CircuitBreaker circuitBreaker;

    public ProductCatalogAdapter(
            ProductHttpClient productHttpClient,
            ObjectMapper objectMapper,
            CircuitBreakerRegistry circuitBreakerRegistry) {
        this.productHttpClient = productHttpClient;
        this.objectMapper = objectMapper;
        this.circuitBreaker = circuitBreakerRegistry.circuitBreaker(PRODUCT_BREAKER);
    }

    @Override
    public Optional<CatalogProduct> findByProductId(String productId) {
        try {
            return circuitBreaker.executeSupplier(() -> fetch(productId));
        } catch (CallNotPermittedException e) {
            throw new ProductCatalogUnavailableException(
                    "product-service circuit breaker OPEN — refusing call until recovery window elapses", e);
        }
    }

    private Optional<CatalogProduct> fetch(String productId) {
        try {
            String json = productHttpClient.getProduct(productId);
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
            throw new ProductCatalogUnavailableException(
                    "product-service returned " + e.getStatusCode() + ": " + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            throw new ProductCatalogUnavailableException(
                    "product-service unreachable or timed out: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new ProductCatalogUnavailableException("failed to read product-service response: " + e.getMessage(), e);
        }
    }

    private static CatalogProduct toDomain(ProductDataDto data) {
        List<CatalogProduct.Variant> variants = data.variants == null ? List.of()
                : data.variants.stream()
                        .map(v -> new CatalogProduct.Variant(
                                v.sku,
                                new Money(
                                        v.priceAmount == null ? BigDecimal.ZERO : v.priceAmount,
                                        v.priceCurrency == null || v.priceCurrency.isBlank() ? "VND" : v.priceCurrency),
                                v.parcel == null ? null : toParcel(v.parcel)))
                        .toList();
        String imageUrl = (data.images == null || data.images.isEmpty()) ? "" : data.images.get(0).url;
        return new CatalogProduct(data.id, data.sellerId, data.name, variants, imageUrl);
    }

    private static ParcelDimensions toParcel(ParcelDto parcel) {
        if (parcel.weightGrams == null || parcel.lengthCm == null
                || parcel.widthCm == null || parcel.heightCm == null
                || parcel.weightGrams <= 0 || parcel.lengthCm <= 0
                || parcel.widthCm <= 0 || parcel.heightCm <= 0) {
            return null;
        }
        return new ParcelDimensions(parcel.weightGrams, parcel.lengthCm, parcel.widthCm, parcel.heightCm);
    }

    // --- DTOs mirroring product-service ApiResponse<ProductResponse> wire shape ---

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class ApiResponseDto {
        @JsonProperty("data")
        public ProductDataDto data;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class ProductDataDto {
        @JsonProperty("id")
        public String id;

        @JsonProperty("sellerId")
        public String sellerId;

        @JsonProperty("name")
        public String name;

        @JsonProperty("variants")
        public List<VariantDto> variants;

        @JsonProperty("images")
        public List<ImageDto> images;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class VariantDto {
        @JsonProperty("sku")
        public String sku;

        @JsonProperty("priceAmount")
        public BigDecimal priceAmount;

        @JsonProperty("priceCurrency")
        public String priceCurrency;

        @JsonProperty("parcel")
        public ParcelDto parcel;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class ParcelDto {
        @JsonProperty("weightGrams")
        public Integer weightGrams;

        @JsonProperty("lengthCm")
        public Integer lengthCm;

        @JsonProperty("widthCm")
        public Integer widthCm;

        @JsonProperty("heightCm")
        public Integer heightCm;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class ImageDto {
        @JsonProperty("url")
        public String url;
    }

    @Configuration
    public static class CircuitBreakerBeanConfig {
        @Bean(name = PRODUCT_BREAKER)
        public CircuitBreaker productServiceCircuitBreaker(CircuitBreakerRegistry registry) {
            return registry.circuitBreaker(PRODUCT_BREAKER, CircuitBreakerConfig.custom()
                    .failureRateThreshold(50)
                    .slidingWindowSize(20)
                    .minimumNumberOfCalls(10)
                    .waitDurationInOpenState(Duration.ofSeconds(30))
                    .permittedNumberOfCallsInHalfOpenState(3)
                    .build());
        }
    }
}
