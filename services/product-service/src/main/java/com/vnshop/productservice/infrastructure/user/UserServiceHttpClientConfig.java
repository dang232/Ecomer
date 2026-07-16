package com.vnshop.productservice.infrastructure.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.productservice.domain.review.port.out.BuyerProfileLookupPort;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

/**
 * Wires the {@link UserServiceHttpClient} declarative proxy and the
 * {@link UserServiceBuyerProfileAdapter} that converts JSON envelopes
 * into {@link BuyerProfileLookupPort} results. Mirrors the same shape
 * as order-service's {@code CouponServiceHttpClientConfig} so the
 * cross-service HTTP clients stay symmetric.
 */
@Configuration
public class UserServiceHttpClientConfig {

    @Bean
    public UserServiceHttpClient userServiceHttpClient(
            @Value("${vnshop.user-service.base-url:http://user-service:8081}") String baseUrl,
            @Value("${vnshop.user-service.connect-timeout-ms:1000}") long connectTimeoutMs,
            @Value("${vnshop.user-service.read-timeout-ms:2000}") long readTimeoutMs) {

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMs));

        RestClient restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();

        return HttpServiceProxyFactory
                .builderFor(RestClientAdapter.create(restClient))
                .build()
                .createClient(UserServiceHttpClient.class);
    }

    @Bean
    public BuyerProfileLookupPort buyerProfileLookupPort(
            UserServiceHttpClient httpClient, ObjectMapper objectMapper) {
        return new UserServiceBuyerProfileAdapter(httpClient, objectMapper);
    }

    @Bean
    public ObjectMapper objectMapper() {
        // Keep the shared mapper aligned with Spring Boot's runtime modules so
        // Instant fields in Kafka events and cache values remain serializable.
        return new ObjectMapper().findAndRegisterModules();
    }
}
