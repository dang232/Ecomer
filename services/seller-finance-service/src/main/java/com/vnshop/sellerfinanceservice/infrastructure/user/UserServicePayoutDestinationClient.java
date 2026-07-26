package com.vnshop.sellerfinanceservice.infrastructure.user;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.sellerfinanceservice.domain.payoutdestination.PayoutDestinationMaterial;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutDestinationClient;
import java.time.Duration;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

@Configuration
@EnableConfigurationProperties(UserServiceClientProperties.class)
public class UserServicePayoutDestinationClient {

    private static final Logger log = LoggerFactory.getLogger(UserServicePayoutDestinationClient.class);

    public interface DestinationHttpClient {
        @GetExchange("/sellers/internal/{sellerId}/payout-destination")
        String fetch(@org.springframework.web.bind.annotation.PathVariable String sellerId);
    }

    @Bean
    DestinationHttpClient destinationHttpClient(
            UserServiceClientProperties properties) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(properties.connectTimeoutMs()));
        requestFactory.setReadTimeout(Duration.ofMillis(properties.readTimeoutMs()));
        RestClient.Builder builder = RestClient.builder()
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory);
        builder.defaultHeaders(headers -> headers.setBearerAuth(properties.internalToken()));
        RestClient restClient = builder.build();
        return HttpServiceProxyFactory.builderFor(RestClientAdapter.create(restClient))
                .build()
                .createClient(DestinationHttpClient.class);
    }

    @Bean
    PayoutDestinationClient payoutDestinationClient(DestinationHttpClient client, ObjectMapper objectMapper) {
        return new HttpAdapter(client, objectMapper);
    }

    static final class HttpAdapter implements PayoutDestinationClient {
        private final DestinationHttpClient client;
        private final ObjectMapper objectMapper;

        HttpAdapter(DestinationHttpClient client, ObjectMapper objectMapper) {
            this.client = client;
            this.objectMapper = objectMapper;
        }

        @Override
        public Optional<PayoutDestinationMaterial> lookup(String sellerId) {
            if (sellerId == null || sellerId.isBlank()) {
                return Optional.empty();
            }
            try {
                String body = client.fetch(sellerId);
                JsonNode root = objectMapper.readTree(body);
                JsonNode data = root.has("data") ? root.path("data") : root;
                if (data == null || data.isMissingNode() || data.isNull()) {
                    return Optional.empty();
                }
                String destinationId = data.path("destinationId").asText(null);
                String returnedSellerId = data.path("sellerId").asText(null);
                String ciphertext = data.path("ciphertextEnvelope").asText(null);
                int keyVersion = data.path("keyVersion").asInt(0);
                String algorithm = data.path("algorithm").asText(null);
                String fingerprint = data.path("fingerprint").asText(null);
                if (destinationId == null || ciphertext == null
                        || returnedSellerId != null && !sellerId.equals(returnedSellerId)) {
                    return Optional.empty();
                }
                return Optional.of(new PayoutDestinationMaterial(
                        destinationId,
                        sellerId,
                        ciphertext,
                        keyVersion,
                        algorithm == null ? "AES-256-GCM" : algorithm,
                        fingerprint == null ? "" : fingerprint
                ));
            } catch (Exception ex) {
                log.warn("payout destination lookup failed for sellerId={}: {}", sellerId, ex.getMessage());
                return Optional.empty();
            }
        }
    }
}
