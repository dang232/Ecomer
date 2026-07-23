package com.vnshop.orderservice.infrastructure.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.port.out.UserDirectoryPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

import java.time.Duration;

@Configuration
public class UserDirectoryHttpClientConfig {
    @Bean
    public UserDirectoryHttpClient userDirectoryHttpClient(
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
        return HttpServiceProxyFactory.builderFor(RestClientAdapter.create(restClient))
                .build()
                .createClient(UserDirectoryHttpClient.class);
    }

    @Bean
    public UserDirectoryPort userDirectoryPort(UserDirectoryHttpClient client, ObjectMapper objectMapper) {
        return new UserDirectoryHttpClientAdapter(client, objectMapper);
    }
}
