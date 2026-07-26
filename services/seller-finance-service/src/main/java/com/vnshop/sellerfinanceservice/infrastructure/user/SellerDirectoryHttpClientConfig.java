package com.vnshop.sellerfinanceservice.infrastructure.user;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerDirectoryPort;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

@Configuration
public class SellerDirectoryHttpClientConfig {
    @Bean
    SellerDirectoryHttpClient sellerDirectoryHttpClient(
            UserServiceClientProperties properties) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(properties.connectTimeoutMs()));
        requestFactory.setReadTimeout(Duration.ofMillis(properties.readTimeoutMs()));
        RestClient restClient = RestClient.builder()
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .build();
        return HttpServiceProxyFactory.builderFor(RestClientAdapter.create(restClient))
                .build()
                .createClient(SellerDirectoryHttpClient.class);
    }

    @Bean
    SellerDirectoryPort sellerDirectoryPort(SellerDirectoryHttpClient client, ObjectMapper objectMapper) {
        return new SellerDirectoryHttpAdapter(client, objectMapper);
    }

    static final class SellerDirectoryHttpAdapter implements SellerDirectoryPort {
        private static final Logger log = LoggerFactory.getLogger(SellerDirectoryHttpAdapter.class);
        private final SellerDirectoryHttpClient client;
        private final ObjectMapper objectMapper;

        SellerDirectoryHttpAdapter(SellerDirectoryHttpClient client, ObjectMapper objectMapper) {
            this.client = client;
            this.objectMapper = objectMapper;
        }

        @Override
        public Map<String, String> lookup(List<String> sellerIds) {
            if (sellerIds == null || sellerIds.isEmpty()) {
                return Map.of();
            }
            try {
                JsonNode root = objectMapper.readTree(client.list(sellerIds.stream().distinct().limit(100).toList()));
                JsonNode data = root.has("data") ? root.path("data") : root;
                if (!data.isArray()) {
                    return Map.of();
                }
                Map<String, String> names = new HashMap<>();
                for (JsonNode item : data) {
                    String id = item.path("sellerId").asText(null);
                    String name = item.path("displayName").asText(null);
                    if (id != null && name != null && !name.isBlank()) {
                        names.put(id, name);
                    }
                }
                return names;
            } catch (Exception ex) {
                log.warn("seller directory lookup failed (idsCount={}): {}", sellerIds.size(), ex.getMessage());
                return Map.of();
            }
        }
    }
}
