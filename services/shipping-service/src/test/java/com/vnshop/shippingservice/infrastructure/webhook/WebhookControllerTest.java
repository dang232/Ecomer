package com.vnshop.shippingservice.infrastructure.webhook;

import com.vnshop.shippingservice.application.ReceiveCarrierWebhookUseCase;
import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import com.vnshop.shippingservice.domain.model.CarrierWebhookOutboxRecord;
import com.vnshop.shippingservice.domain.port.out.CarrierWebhookOutboxPort;
import com.vnshop.shippingservice.infrastructure.carrier.GhnProperties;
import com.vnshop.shippingservice.infrastructure.carrier.GhtkProperties;
import com.vnshop.shippingservice.infrastructure.config.WebhookSecurityProperties;
import com.vnshop.shippingservice.infrastructure.web.GhnWebhookController;
import com.vnshop.shippingservice.infrastructure.web.GhtkWebhookController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.time.Clock;
import java.time.ZoneOffset;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class WebhookControllerTest {

    private MockMvc ghtkMockMvc;
    private MockMvc ghnMockMvc;
    private InMemoryOutbox outbox;

    @BeforeEach
    void setUp() {
        outbox = new InMemoryOutbox();
        ReceiveCarrierWebhookUseCase useCase = new ReceiveCarrierWebhookUseCase(outbox);

        GhtkProperties ghtkProps = new GhtkProperties("https://test.ghtk.vn", null, "test", "test-secret");
        ghtkMockMvc = MockMvcBuilders.standaloneSetup(new GhtkWebhookController(
                useCase, ghtkValidator(ghtkProps), new GhtkWebhookMapper())).build();

        GhnProperties ghnProps = new GhnProperties("https://test.ghn.vn", null, "12345", "2", "ghn-secret");
        ghnMockMvc = MockMvcBuilders.standaloneSetup(new GhnWebhookController(
                useCase, ghnValidator(ghnProps), new GhnWebhookMapper())).build();
    }

    @Test
    void ghtk_validWebhook_returns200AndPersistsEvent() throws Exception {
        String payload = "{\"label_id\":\"GHTK123456\",\"status\":\"delivering\",\"status_text\":\"Dang giao hang\",\"updated_at\":\"2026-07-21T10:30:00Z\",\"order_id\":\"ORD-12345\"}";

        ghtkMockMvc.perform(post("/webhooks/ghtk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .header("X-GHTK-Signature", ghtkSignature(new GhtkWebhookPayload(
                                "GHTK123456", "delivering", "Dang giao hang", "2026-07-21T10:30:00Z",
                                "ORD-12345", null, null, null), "test-secret")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));

        CarrierWebhookEvent event = outbox.lastEvent();
        assertNotNull(event);
        assertEquals("ORD-12345", event.orderId());
        assertEquals("OUT_FOR_DELIVERY", event.status());
    }

    @Test
    void ghtk_invalidSignature_returns401() throws Exception {
        GhtkProperties ghtkProps = new GhtkProperties("https://test.ghtk.vn", "test-token", "test", "test-token");
        GhtkWebhookController controller = new GhtkWebhookController(
                new ReceiveCarrierWebhookUseCase(outbox),
                new GhtkWebhookSignatureService(ghtkProps),
                new GhtkWebhookMapper());

        String payload = "{\"label_id\":\"GHTK123456\",\"status\":\"delivering\",\"updated_at\":\"2026-07-21T10:30:00Z\"}";

        MockMvcBuilders.standaloneSetup(controller).build().perform(post("/webhooks/ghtk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .header("X-GHTK-Signature", "invalid"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid signature"));
    }

    @Test
    void ghtk_duplicateEvent_isIdempotent() throws Exception {
        String payload = "{\"label_id\":\"GHTK123456\",\"status\":\"delivering\",\"status_text\":\"Dang giao hang\",\"updated_at\":\"2026-07-21T10:30:00Z\",\"order_id\":\"ORD-12345\"}";

        GhtkWebhookPayload duplicatePayload = new GhtkWebhookPayload(
                "GHTK123456", "delivering", "Dang giao hang", "2026-07-21T10:30:00Z",
                "ORD-12345", null, null, null);
        ghtkMockMvc.perform(post("/webhooks/ghtk").contentType(MediaType.APPLICATION_JSON).content(payload)
                        .header("X-GHTK-Signature", ghtkSignature(duplicatePayload, "test-secret")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));

        ghtkMockMvc.perform(post("/webhooks/ghtk").contentType(MediaType.APPLICATION_JSON).content(payload)
                        .header("X-GHTK-Signature", ghtkSignature(duplicatePayload, "test-secret")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("duplicate"));
    }

    @Test
    void ghtk_formWebhook_mapsCarrierFields() throws Exception {
        ghtkMockMvc.perform(post("/webhooks/ghtk")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("label_id", "GHTK-FORM")
                        .param("status_id", "8")
                        .param("action_time", "2026-07-21T10:30:00Z")
                        .header("X-GHTK-Signature", ghtkSignature(new GhtkWebhookPayload(
                                "GHTK-FORM", "8", null, "2026-07-21T10:30:00Z", null,
                                null, null, null), "test-secret")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));

        assertEquals("DELIVERED", outbox.lastEvent().status());
    }

    @Test
    void ghn_validWebhook_returns200AndPersistsEvent() throws Exception {
        String payload = "{\"OrderCode\":\"GHN123456\",\"Status\":\"Delivered\",\"StatusCode\":\"8\",\"UpdatedDate\":\"2026-07-21T10:30:00Z\",\"ClientOrderCode\":\"ORD-12345\"}";

        ghnMockMvc.perform(post("/webhooks/ghn")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .header("X-GHN-Signature", ghnSignature(new GhnWebhookPayload(
                                "GHN123456", "Delivered", "8", "2026-07-21T10:30:00Z", "ORD-12345",
                                null, null, null), "ghn-secret")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));

        assertEquals("ORD-12345", outbox.lastEvent().orderId());
        assertEquals("DELIVERED", outbox.lastEvent().status());
    }

    @Test
    void ghn_realPayloadAliasesTimeAndStatus_returnsCanonicalStatus() throws Exception {
        String payload = "{\"OrderCode\":\"GHN-TIME\",\"Status\":\"Delivered\",\"Time\":\"2026-07-21T10:30:00Z\"}";

        ghnMockMvc.perform(post("/webhooks/ghn")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .header("X-GHN-Signature", ghnSignature(new GhnWebhookPayload(
                                "GHN-TIME", "Delivered", null, "2026-07-21T10:30:00Z", null,
                                null, null, null), "ghn-secret")))
                .andExpect(status().isOk());

        assertEquals("DELIVERED", outbox.lastEvent().status());
    }

    @Test
    void ghn_invalidToken_returns401() throws Exception {
        GhnProperties ghnProps = new GhnProperties("https://test.ghn.vn", "test-token", "12345", "2", "test-token");
        GhnWebhookController controller = new GhnWebhookController(
                new ReceiveCarrierWebhookUseCase(outbox),
                new GhnWebhookSignatureService(ghnProps),
                new GhnWebhookMapper());

        String payload = "{\"OrderCode\":\"GHN123456\",\"Status\":\"Delivered\",\"StatusCode\":\"8\"}";

        MockMvcBuilders.standaloneSetup(controller).build().perform(post("/webhooks/ghn")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .header("X-GHN-Token", "wrong"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid signature"));
    }

    @Test
    void ghn_duplicateEvent_isIdempotent() throws Exception {
        String payload = "{\"OrderCode\":\"GHN123456\",\"Status\":\"Delivered\",\"StatusCode\":\"8\",\"UpdatedDate\":\"2026-07-21T10:30:00Z\",\"ClientOrderCode\":\"ORD-12345\"}";

        GhnWebhookPayload duplicatePayload = new GhnWebhookPayload(
                "GHN123456", "Delivered", "8", "2026-07-21T10:30:00Z", "ORD-12345",
                null, null, null);
        ghnMockMvc.perform(post("/webhooks/ghn").contentType(MediaType.APPLICATION_JSON).content(payload)
                        .header("X-GHN-Signature", ghnSignature(duplicatePayload, "ghn-secret")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));

        ghnMockMvc.perform(post("/webhooks/ghn").contentType(MediaType.APPLICATION_JSON).content(payload)
                        .header("X-GHN-Signature", ghnSignature(duplicatePayload, "ghn-secret")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("duplicate"));
    }

    @Test
    void webhookStorageFailure_returns503() throws Exception {
        ReceiveCarrierWebhookUseCase useCase = new ReceiveCarrierWebhookUseCase(new FailingOutbox());
        GhtkWebhookController controller = new GhtkWebhookController(
                useCase,
                ghtkValidator(new GhtkProperties("https://test.ghtk.vn", null, "test", "test-secret")),
                new GhtkWebhookMapper());

        MockMvcBuilders.standaloneSetup(controller).build().perform(post("/webhooks/ghtk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label_id\":\"GHTK-FAIL\",\"status\":\"delivering\",\"updated_at\":\"2026-07-21T10:30:00Z\"}")
                        .header("X-GHTK-Signature", ghtkSignature(new GhtkWebhookPayload(
                                "GHTK-FAIL", "delivering", null, "2026-07-21T10:30:00Z", null,
                                null, null, null), "test-secret")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("error"));
    }

    @Test
    void missingCredentialsFailClosedWithoutTheLocalOptIn() throws Exception {
        GhnWebhookController controller = new GhnWebhookController(
                new ReceiveCarrierWebhookUseCase(outbox),
                new GhnWebhookSignatureService(new GhnProperties("https://test.ghn.vn", null, "12345", "2", null)),
                new GhnWebhookMapper());

        MockMvcBuilders.standaloneSetup(controller).build().perform(post("/webhooks/ghn")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"OrderCode\":\"GHN-NO-CREDENTIALS\",\"Status\":\"Delivered\"}"))
                .andExpect(status().isUnauthorized());
    }

    private static GhnWebhookSignatureService ghnValidator(GhnProperties properties) {
        return new GhnWebhookSignatureService(properties, new WebhookSecurityProperties(true),
                Clock.fixed(Instant.parse("2026-07-21T10:35:00Z"), ZoneOffset.UTC));
    }

    private static GhtkWebhookSignatureService ghtkValidator(GhtkProperties properties) {
        return new GhtkWebhookSignatureService(properties, new WebhookSecurityProperties(true),
                Clock.fixed(Instant.parse("2026-07-21T10:35:00Z"), ZoneOffset.UTC));
    }

    private static StandardEnvironment localEnvironment() {
        StandardEnvironment environment = new StandardEnvironment();
        environment.setActiveProfiles("local");
        return environment;
    }

    private static String ghtkSignature(GhtkWebhookPayload payload, String secret) throws Exception {
        return sign(canonical("vnshop-ghtk-webhook-v1", new String[][]{
                {"label_id", payload.labelId()}, {"status", payload.status()}, {"status_text", payload.statusText()},
                {"updated_at", payload.updatedAt()}, {"order_id", payload.orderId()}, {"cod_collected_amount", null},
                {"collection_id", null}, {"currency", null}}), secret);
    }

    private static String ghnSignature(GhnWebhookPayload payload, String secret) throws Exception {
        return sign(canonical("vnshop-ghn-webhook-v1", new String[][]{
                {"order_code", payload.orderCode()}, {"status", payload.status()}, {"status_code", payload.statusCode()},
                {"updated_date", payload.updatedDate()}, {"client_order_code", payload.clientOrderCode()},
                {"cod_collected_amount", null}, {"collection_id", null}, {"currency", null}}), secret);
    }

    private static String canonical(String prefix, String[][] fields) {
        StringBuilder result = new StringBuilder(prefix).append('|');
        for (String[] field : fields) {
            append(result, field[0]);
            append(result, field[1]);
            result.append(';');
        }
        return result.toString();
    }

    private static void append(StringBuilder result, String value) {
        String normalized = value == null ? "" : value;
        result.append(normalized.getBytes(StandardCharsets.UTF_8).length).append(':').append(normalized);
    }

    private static String sign(String value, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return Base64.getEncoder().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    }

    private static class InMemoryOutbox implements CarrierWebhookOutboxPort {
        private final Map<String, CarrierWebhookEvent> events = new ConcurrentHashMap<>();

        @Override
        public boolean accept(CarrierWebhookEvent event) {
            return events.putIfAbsent(event.carrier() + ":" + event.eventId(), event) == null;
        }

        CarrierWebhookEvent lastEvent() {
            return events.values().stream().reduce((first, second) -> second).orElse(null);
        }

        @Override public List<CarrierWebhookOutboxRecord> findPending(int batchSize) { return List.of(); }
        @Override public boolean claim(UUID id) { return false; }
        @Override public int recoverStaleClaims(Instant cutoff) { return 0; }
        @Override public void markPublished(UUID id) {}
        @Override public void recordFailure(UUID id, int attempts, Instant nextRetryAt, boolean dead, String error) {}
    }

    private static final class FailingOutbox extends InMemoryOutbox {
        @Override
        public boolean accept(CarrierWebhookEvent event) {
            throw new IllegalStateException("outbox unavailable");
        }
    }
}
