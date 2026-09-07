package com.vnshop.orderservice.infrastructure.product;

import com.vnshop.orderservice.infrastructure.HttpClients;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires the {@link ProductHttpClient} declarative proxy. Timeout configuration
 * that previously lived in {@link ProductCatalogAdapter}'s constructor is now
 * owned here so the adapter itself is free of infrastructure concerns.
 */
@Configuration
public class ProductHttpClientConfig {

    @Bean
    public ProductHttpClient productHttpClient(
            @Value("${vnshop.product-service.base-url:http://product-service:8082}") String baseUrl,
            @Value("${vnshop.product-service.connect-timeout-ms:1000}") long connectTimeoutMs,
            @Value("${vnshop.product-service.read-timeout-ms:2000}") long readTimeoutMs) {

        return HttpClients.newClient(baseUrl, connectTimeoutMs, readTimeoutMs, ProductHttpClient.class);
    }
}
