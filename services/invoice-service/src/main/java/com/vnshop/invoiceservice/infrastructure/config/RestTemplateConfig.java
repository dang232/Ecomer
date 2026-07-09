package com.vnshop.invoiceservice.infrastructure.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * RestTemplate configuration with timeouts for external API calls.
 * Connect timeout: 5s - time to establish connection
 * Read timeout: 10s - time to wait for response
 */
@Configuration
public class RestTemplateConfig {

    @Value("${vnshop.rest-template.connect-timeout-ms:5000}")
    private long connectTimeoutMs;

    @Value("${vnshop.rest-template.read-timeout-ms:10000}")
    private long readTimeoutMs;

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        factory.setReadTimeout(Duration.ofMillis(readTimeoutMs));
        return new RestTemplate(factory);
    }
}
