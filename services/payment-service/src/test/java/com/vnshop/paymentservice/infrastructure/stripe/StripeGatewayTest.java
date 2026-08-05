package com.vnshop.paymentservice.infrastructure.stripe;

import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.net.RequestOptions;
import com.stripe.param.PaymentIntentCreateParams;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.FxRatePort;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StripeGatewayTest {

    @Test
    void rejectsBlankSecretAtConstruction() {
        StripeProperties props = new StripeProperties(true, "", "pk_test", "whsec_x");
        FxRatePort fx = (from, to) -> new BigDecimal("0.00004");

        assertThatThrownBy(() -> new StripeGateway(props, fx, mock(StripeIntentClient.class)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Stripe secret key");
    }

    @Test
    void rejectsBlankWebhookSecretAtConstruction() {
        StripeProperties props = new StripeProperties(true, "sk_test", "pk_test", "");
        FxRatePort fx = (from, to) -> new BigDecimal("0.00004");

        assertThatThrownBy(() -> new StripeGateway(props, fx, mock(StripeIntentClient.class)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("webhook");
    }

    @Test
    void buildsPaymentIntentWithUsdAmountAndMetadata() throws StripeException {
        StripeProperties props = new StripeProperties(true, "sk_test_secret", "pk_test_pub", "whsec_xyz");
        FxRatePort fx = (from, to) -> new BigDecimal("0.00004"); // 1 VND = 0.00004 USD
        StripeIntentClient client = mock(StripeIntentClient.class);
        PaymentIntent stub = stubIntent("pi_123", "pi_123_secret_abc");
        when(client.create(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any())).thenReturn(stub);

        StripeGateway gateway = new StripeGateway(props, fx, client);
        Payment payment = new Payment(
                UUID.fromString("00000000-0000-0000-0000-000000000123"),
                "ORDER-1", "BUYER-1", new BigDecimal("100000"),
                PaymentMethod.STRIPE, PaymentStatus.PENDING, null,
                Instant.parse("2026-05-19T00:00:00Z"));

        StripeGateway.StripeIntent intent = gateway.createPaymentIntent(payment);

        assertThat(intent.intentId()).isEqualTo("pi_123");
        assertThat(intent.clientSecret()).isEqualTo("pi_123_secret_abc");
        assertThat(intent.externalAmount()).isEqualByComparingTo("4.00");
        assertThat(intent.externalCurrency()).isEqualTo("USD");
        assertThat(intent.fxRate()).isEqualByComparingTo("0.00004");

        var paramsCaptor = forClass(PaymentIntentCreateParams.class);
        var optionsCaptor = forClass(RequestOptions.class);
        verify(client).create(paramsCaptor.capture(), optionsCaptor.capture());
        PaymentIntentCreateParams params = paramsCaptor.getValue();
        // 100000 VND * 0.00004 USD/VND = 4 USD = 400 cents
        assertThat(params.getAmount()).isEqualTo(400L);
        assertThat(params.getCurrency()).isEqualTo("usd");
        assertThat(params.getMetadata()).containsEntry("paymentId", "00000000-0000-0000-0000-000000000123");
        assertThat(params.getMetadata()).containsEntry("orderId", "ORDER-1");
        assertThat(params.getMetadata()).containsEntry("vndAmount", "100000");
        assertThat(params.getMetadata()).containsEntry("fxRate", "0.00004");
        assertThat(optionsCaptor.getValue().getIdempotencyKey())
                .isEqualTo("create:stripe:00000000-0000-0000-0000-000000000123");
    }

    private static PaymentIntent stubIntent(String id, String clientSecret) {
        PaymentIntent intent = new PaymentIntent();
        intent.setId(id);
        intent.setClientSecret(clientSecret);
        return intent;
    }
}
