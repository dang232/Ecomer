package com.vnshop.sellerfinanceservice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.sellerfinanceservice.domain.Payout;
import com.vnshop.sellerfinanceservice.domain.PayoutStatus;
import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerDirectoryPort;
import com.vnshop.sellerfinanceservice.infrastructure.persistence.ProcessedOrderEventRepository;
import com.vnshop.sellerfinanceservice.infrastructure.persistence.ProcessedRefundRepository;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.autoconfigure.exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration,org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration,org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration"
})
class SellerFinanceControllerTest {

    private static final String SELLER_ID = "seller-1";

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @LocalServerPort
    private int port;

    @MockitoBean
    private ObjectMapper contextObjectMapper;

    @MockitoBean
    private SellerWalletRepositoryPort sellerWalletRepositoryPort;

    @MockitoBean
    private PayoutRepositoryPort payoutRepositoryPort;

    @MockitoBean
    private SellerDirectoryPort sellerDirectoryPort;

    @MockitoBean
    private ProcessedRefundRepository processedRefundRepository;

    @MockitoBean
    private ProcessedOrderEventRepository processedOrderEventRepository;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @BeforeEach
    void configureJwt() {
        Jwt jwt = new Jwt(
                "token",
                Instant.now(),
                Instant.now().plusSeconds(300),
                Map.of("alg", "none"),
                Map.of("sub", SELLER_ID, "realm_access", Map.of("roles", List.of("ADMIN", "SELLER")))
        );
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(sellerDirectoryPort.lookup(any())).thenReturn(Map.of(SELLER_ID, "Alice Shop"));
    }

    @Test
    void getPayoutsReturnsList() throws Exception {
        Payout payout = new Payout(UUID.randomUUID(), SELLER_ID, new BigDecimal("125.50"), PayoutStatus.PENDING, Instant.parse("2026-05-14T00:00:00Z"));
        when(payoutRepositoryPort.findBySellerId(SELLER_ID)).thenReturn(List.of(payout));

        HttpRequest request = authorizedRequest("/sellers/me/finance/payouts")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode body = objectMapper.readTree(response.body());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(body.get("success").asBoolean()).isTrue();
        assertThat(body.get("data")).hasSize(1);
        assertThat(body.get("data").get(0).get("sellerId").asText()).isEqualTo(SELLER_ID);
        assertThat(body.get("data").get(0).get("status").asText()).isEqualTo("PENDING");
    }

    @Test
    void walletReturnsTheSeparateSettlementProjectionBuckets() throws Exception {
        SellerWallet wallet = new SellerWallet(
                SELLER_ID, new BigDecimal("60.00"), new BigDecimal("25.00"), new BigDecimal("5.00"),
                new BigDecimal("10.00"), new BigDecimal("3.00"), new BigDecimal("2.00"),
                new BigDecimal("1.00"), new BigDecimal("4.00"), new BigDecimal("100.00"), null, 7);
        when(sellerWalletRepositoryPort.findBySellerId(SELLER_ID)).thenReturn(Optional.of(wallet));

        HttpRequest request = authorizedRequest("/sellers/me/finance/wallet")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode data = objectMapper.readTree(response.body()).get("data");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(data.get("settlementPendingBalance").decimalValue()).isEqualByComparingTo("25.00");
        assertThat(data.get("reserveBalance").decimalValue()).isEqualByComparingTo("5.00");
        assertThat(data.get("payoutPendingBalance").decimalValue()).isEqualByComparingTo("10.00");
        assertThat(data.get("debtBalance").decimalValue()).isEqualByComparingTo("3.00");
        assertThat(data.get("totalFees").decimalValue()).isEqualByComparingTo("2.00");
        assertThat(data.get("totalRefunded").decimalValue()).isEqualByComparingTo("1.00");
        assertThat(data.get("totalPaidOut").decimalValue()).isEqualByComparingTo("4.00");
    }

    @Test
    void requestPayoutReturnsValidResponse() throws Exception {
        SellerWallet wallet = new SellerWallet(SELLER_ID, new BigDecimal("200.00"), BigDecimal.ZERO, new BigDecimal("200.00"), null);
        Payout savedPayout = new Payout(UUID.randomUUID(), SELLER_ID, new BigDecimal("125.50"), PayoutStatus.PENDING, Instant.parse("2026-05-14T00:00:00Z"));
        when(sellerWalletRepositoryPort.findBySellerId(SELLER_ID)).thenReturn(Optional.of(wallet));
        when(payoutRepositoryPort.save(any(Payout.class))).thenReturn(savedPayout);

        HttpRequest request = authorizedRequest("/sellers/me/finance/payouts")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"amount\":125.50}"))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode body = objectMapper.readTree(response.body());
        JsonNode data = body.get("data");

        assertThat(response.statusCode()).isEqualTo(201);
        assertThat(body.get("success").asBoolean()).isTrue();
        assertThat(data.get("payoutId").asText()).isNotBlank();
        assertThat(data.get("sellerId").asText()).isEqualTo(SELLER_ID);
        assertThat(data.get("amount").decimalValue()).isEqualByComparingTo("125.50");
        assertThat(data.get("status").asText()).isEqualTo("PENDING");
    }

    @Test
    void completePayoutCapturesAuditFields() throws Exception {
        UUID payoutId = UUID.randomUUID();
        Payout pending = new Payout(payoutId, SELLER_ID, new BigDecimal("125.50"), PayoutStatus.PENDING, Instant.parse("2026-05-14T00:00:00Z"));
        SellerWallet wallet = new SellerWallet(SELLER_ID, BigDecimal.ZERO, new BigDecimal("125.50"), new BigDecimal("125.50"), null);
        when(payoutRepositoryPort.findById(payoutId)).thenReturn(Optional.of(pending));
        when(sellerWalletRepositoryPort.findBySellerId(SELLER_ID)).thenReturn(Optional.of(wallet));
        // The use case mutates `pending` in place and saves it; echo the
        // mutated instance back so the controller serializes the audit
        // fields the use case just stamped on.
        when(payoutRepositoryPort.save(any(Payout.class))).thenAnswer(inv -> inv.getArgument(0));

        HttpRequest request = authorizedRequest("/admin/finance/payouts/" + payoutId + "/complete")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"reason\":\"manual transfer verified\",\"evidence\":{"
                                + "\"externalReference\":\"bank-ref-1\",\"evidenceHash\":\"sha256:1\","
                                + "\"maskedDestinationConfirmed\":true}}"))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode body = objectMapper.readTree(response.body());
        JsonNode data = body.get("data");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(data.get("status").asText()).isEqualTo("COMPLETED");
        assertThat(data.get("completedBy").asText()).isEqualTo(SELLER_ID);
        assertThat(data.get("completedAt").asText()).isNotBlank();
    }

    @Test
    void completePayoutRequiresManualEvidence() throws Exception {
        UUID payoutId = UUID.randomUUID();
        Payout pending = new Payout(payoutId, SELLER_ID, new BigDecimal("125.50"), PayoutStatus.PENDING,
                Instant.parse("2026-05-14T00:00:00Z"));
        when(payoutRepositoryPort.findById(payoutId)).thenReturn(Optional.of(pending));

        HttpRequest request = authorizedRequest("/admin/finance/payouts/" + payoutId + "/complete")
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(400);
    }

    @Test
    void completedPayoutsListReturnsAuditFields() throws Exception {
        UUID payoutId = UUID.randomUUID();
        Instant completedAt = Instant.parse("2026-05-24T08:30:00Z");
        Payout completed = new Payout(
                payoutId,
                SELLER_ID,
                new BigDecimal("125.50"),
                PayoutStatus.COMPLETED,
                Instant.parse("2026-05-14T00:00:00Z"),
                "admin-42",
                completedAt);
        when(payoutRepositoryPort.findCompleted()).thenReturn(List.of(completed));

        HttpRequest request = authorizedRequest("/admin/finance/payouts/completed").GET().build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode body = objectMapper.readTree(response.body());

        assertThat(response.statusCode()).isEqualTo(200);
        JsonNode row = body.get("data").get(0);
        assertThat(row.get("payoutId").asText()).isEqualTo(payoutId.toString());
        assertThat(row.get("status").asText()).isEqualTo("COMPLETED");
        assertThat(row.get("completedBy").asText()).isEqualTo("admin-42");
        assertThat(row.get("completedAt").asText()).isEqualTo(completedAt.toString());
        assertThat(row.get("sellerName").asText()).isEqualTo("Alice Shop");
    }

    private HttpRequest.Builder authorizedRequest(String path) {
        return HttpRequest.newBuilder(url(path))
                .header("Authorization", "Bearer token");
    }

    private URI url(String path) {
        return URI.create("http://localhost:" + port + path);
    }
}
