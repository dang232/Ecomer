package com.vnshop.orderservice.infrastructure.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.ParcelDimensions;
import com.vnshop.orderservice.domain.catalog.CatalogProduct;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ProductCatalogAdapterTest {

    @Test
    void mapsCompleteVariantParcelMetadata() {
        ProductHttpClient client = mock(ProductHttpClient.class);
        when(client.getProduct("product-1")).thenReturn("""
                {"data":{"id":"product-1","sellerId":"seller-1","name":"Product","variants":[
                  {"sku":"sku-1","priceAmount":100000,"priceCurrency":"VND",
                   "parcel":{"weightGrams":1200,"lengthCm":30,"widthCm":20,"heightCm":10}}
                ],"images":[]}}
                """);

        var product = new ProductCatalogAdapter(client, new ObjectMapper(), CircuitBreakerRegistry.ofDefaults())
                .findByProductId("product-1").orElseThrow();

        assertThat(product.findVariant("sku-1").orElseThrow().parcel())
                .isEqualTo(new ParcelDimensions(1200, 30, 20, 10));
    }

    @Test
    void ignoresIncompleteOrInvalidVariantParcelMetadata() {
        ProductHttpClient client = mock(ProductHttpClient.class);
        when(client.getProduct("product-1")).thenReturn("""
                {"data":{"id":"product-1","sellerId":"seller-1","name":"Product","variants":[
                  {"sku":"partial","priceAmount":100000,"priceCurrency":"VND",
                   "parcel":{"weightGrams":1200,"lengthCm":30,"widthCm":20}},
                  {"sku":"invalid","priceAmount":100000,"priceCurrency":"VND",
                   "parcel":{"weightGrams":0,"lengthCm":30,"widthCm":20,"heightCm":10}}
                ],"images":[]}}
                """);

        var variants = new ProductCatalogAdapter(client, new ObjectMapper(), CircuitBreakerRegistry.ofDefaults())
                .findByProductId("product-1").orElseThrow().variants();

        assertThat(variants).extracting(CatalogProduct.Variant::parcel).containsExactly(null, null);
    }
}
