package com.vnshop.orderservice.infrastructure.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Iterator;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.stereotype.Component;

/**
 * Fetches configuration from the centralized configuration-service on startup
 * and injects it into Spring's Environment as a property source. Falls back
 * to local application.yml defaults if the config-service is unreachable.
 */
@Slf4j
@Component
public class ConfigServiceClient implements ApplicationRunner {

    private final ConfigurableEnvironment environment;
    private final ObjectMapper objectMapper;

    @Value("${config-service.url:http://configuration-service:8097}")
    private String configServiceUrl;

    @Value("${spring.application.name:order-service}")
    private String serviceName;

    @Value("${config-service.enabled:true}")
    private boolean enabled;

    @Value("${config-service.timeout-ms:3000}")
    private long timeoutMs;

    @Value("${config-service.token:}")
    private String token;

    public ConfigServiceClient(ConfigurableEnvironment environment, ObjectMapper objectMapper) {
        this.environment = environment;
        this.objectMapper = objectMapper;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.info("Config service client disabled, using local defaults");
            return;
        }

        try {
            String url = configServiceUrl + "/api/config/services/" + serviceName;
            log.info("Fetching configuration from {}", url);

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofMillis(timeoutMs))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofMillis(timeoutMs))
                    .header("x-config-service-token", token)
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                Map<String, Object> props = new java.util.HashMap<>();
                flattenJson("", root, props);

                MapPropertySource propertySource = new MapPropertySource("configService", props);
                // Add with lower priority than system/env but higher than application.yml
                environment.getPropertySources().addLast(propertySource);
                log.info("Loaded {} properties from configuration-service", props.size());
            } else {
                log.warn("Config service returned HTTP {}, using local defaults", response.statusCode());
            }
        } catch (Exception e) {
            log.warn("Could not reach configuration-service ({}), using local defaults", e.getMessage());
        }
    }

    private void flattenJson(String prefix, JsonNode node, Map<String, Object> props) {
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                String key = prefix.isEmpty() ? field.getKey() : prefix + "." + field.getKey();
                flattenJson(key, field.getValue(), props);
            }
        } else if (node.isArray()) {
            for (int i = 0; i < node.size(); i++) {
                flattenJson(prefix + "[" + i + "]", node.get(i), props);
            }
        } else {
            props.put(prefix, node.asText());
        }
    }
}
