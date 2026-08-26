package com.vnshop.shippingservice.infrastructure.webhook;

import com.vnshop.shippingservice.infrastructure.carrier.GhnProperties;
import com.vnshop.shippingservice.infrastructure.carrier.GhtkProperties;
import com.vnshop.shippingservice.infrastructure.config.WebhookSecurityProperties;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.StandardEnvironment;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

class WebhookSignatureServiceTest {
    private static final String GHTK_SECRET = "ghtk-independent-webhook-secret";
    private static final String GHN_SECRET = "ghn-independent-webhook-secret";

    @Test
    void ghtkUsesBase64HmacOverLengthSafeCanonicalFields() throws Exception {
        GhtkWebhookPayload payload = new GhtkWebhookPayload(
                "GHTK-1", "delivering", "Dang giao hang", Instant.now().toString(),
                "ORDER-1", new java.math.BigDecimal("125000.00"), "COL-1", "VND");
        GhtkWebhookSignatureService service = ghtk(GHTK_SECRET);

        String canonical = canonicalGhtk(payload);

        assertThat(service.isValid(payload, hmacBase64(canonical, GHTK_SECRET))).isTrue();
    }

    @Test
    void ghtkRejectsAFieldMutationEvenWhenTheOldPrefixStillMatches() throws Exception {
        GhtkWebhookPayload payload = new GhtkWebhookPayload(
                "GHTK-1", "delivering", "Dang giao hang", Instant.now().toString(),
                "ORDER-1", new java.math.BigDecimal("125000.00"), "COL-1", "VND");
        GhtkWebhookSignatureService service = ghtk(GHTK_SECRET);
        String signature = hmacBase64(canonicalGhtk(payload), GHTK_SECRET);

        GhtkWebhookPayload mutated = new GhtkWebhookPayload(
                payload.labelId(), "delivered", payload.statusText(), payload.updatedAt(),
                payload.orderId(), payload.codCollectedAmount(), payload.collectionId(), payload.currency());

        assertThat(service.isValid(mutated, signature)).isFalse();
    }

    @Test
    void ghtkRejectsTimestampOutsideReplayWindow() throws Exception {
        GhtkWebhookPayload payload = new GhtkWebhookPayload(
                "GHTK-1", "delivering", "Dang giao hang", Instant.now().minusSeconds(3601).toString(),
                "ORDER-1", null, null, null);
        GhtkWebhookSignatureService service = ghtk(GHTK_SECRET);

        assertThat(service.isValid(payload, hmacBase64(canonicalGhtk(payload), GHTK_SECRET))).isFalse();
    }

    @Test
    void ghtkRejectsMissingSecretEvenWhenLocalInsecureFlagIsSet() {
        GhtkWebhookPayload payload = new GhtkWebhookPayload(
                "GHTK-1", "delivering", null, "2026-08-25T12:00:00Z", "ORDER-1");
        StandardEnvironment environment = new StandardEnvironment();
        environment.setActiveProfiles("local");
        GhtkWebhookSignatureService service = new GhtkWebhookSignatureService(
                new GhtkProperties("https://ghtk.test", "carrier-token", "partner", null),
                new WebhookSecurityProperties(true),
                environment);

        assertThat(service.isValid(payload, "anything")).isFalse();
    }

    @Test
    void ghnRequiresIndependentHmacSignatureInsteadOfCarrierApiToken() throws Exception {
        GhnWebhookPayload payload = new GhnWebhookPayload(
                "GHN-1", "Delivered", "8", Instant.now().toString(), "ORDER-1",
                null, null, "VND");
        GhnWebhookSignatureService service = new GhnWebhookSignatureService(
                new GhnProperties("https://ghn.test", "carrier-token", "123", "2", GHN_SECRET),
                new WebhookSecurityProperties(false),
                Clock.systemUTC());

        assertThat(service.isValid(payload, hmacBase64(canonicalGhn(payload), GHN_SECRET), "wrong-token"))
                .isTrue();
    }

    @Test
    void ghnRejectsTimestampOutsideReplayWindow() throws Exception {
        GhnWebhookPayload payload = new GhnWebhookPayload(
                "GHN-1", "Delivered", "8", "2026-08-25T11:54:59Z", "ORDER-1",
                null, null, "VND");
        GhnWebhookSignatureService service = new GhnWebhookSignatureService(
                new GhnProperties("https://ghn.test", "carrier-token", "123", "2", GHN_SECRET),
                new WebhookSecurityProperties(false),
                Clock.fixed(Instant.parse("2026-08-25T12:00:00Z"), ZoneOffset.UTC));

        assertThat(service.isValid(payload, hmacBase64(canonicalGhn(payload), GHN_SECRET), "wrong-token"))
                .isFalse();
    }

    @Test
    void replayWindowMustBePositiveAndAtMostFiveMinutes() {
        org.junit.jupiter.api.Assertions.assertAll(
                () -> org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
                        () -> new WebhookSecurityProperties(false, 0)),
                () -> org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
                        () -> new WebhookSecurityProperties(false, -1)),
                () -> org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
                        () -> new WebhookSecurityProperties(false, 301)));
    }

    private static GhtkWebhookSignatureService ghtk(String secret) {
        return new GhtkWebhookSignatureService(
                new GhtkProperties("https://ghtk.test", "carrier-token", "partner", secret),
                new WebhookSecurityProperties(false),
                new StandardEnvironment());
    }

    private static String canonicalGhtk(GhtkWebhookPayload payload) {
        return canonical("vnshop-ghtk-webhook-v1", new String[][]{
                {"label_id", payload.labelId()},
                {"status", payload.status()},
                {"status_text", payload.statusText()},
                {"updated_at", Instant.parse(payload.updatedAt()).toString()},
                {"order_id", payload.orderId()},
                {"cod_collected_amount", payload.codCollectedAmount() == null ? null : payload.codCollectedAmount().stripTrailingZeros().toPlainString()},
                {"collection_id", payload.collectionId()},
                {"currency", payload.currency()}
        });
    }

    private static String canonicalGhn(GhnWebhookPayload payload) {
        return canonical("vnshop-ghn-webhook-v1", new String[][]{
                {"order_code", payload.orderCode()},
                {"status", payload.status()},
                {"status_code", payload.statusCode()},
                {"updated_date", payload.updatedDate()},
                {"client_order_code", payload.clientOrderCode()},
                {"cod_collected_amount", payload.codCollectedAmount() == null ? null : payload.codCollectedAmount().stripTrailingZeros().toPlainString()},
                {"collection_id", payload.collectionId()},
                {"currency", payload.currency()}
        });
    }

    private static String canonical(String prefix, String[][] fields) {
        StringBuilder result = new StringBuilder(prefix).append('|');
        for (String[] field : fields) {
            appendLengthPrefixed(result, field[0]);
            appendLengthPrefixed(result, field[1]);
            result.append(';');
        }
        return result.toString();
    }

    private static void appendLengthPrefixed(StringBuilder result, String value) {
        String normalized = value == null ? "" : value;
        byte[] bytes = normalized.getBytes(StandardCharsets.UTF_8);
        result.append(bytes.length).append(':').append(normalized);
    }

    private static String hmacBase64(String value, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return Base64.getEncoder().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    }
}
