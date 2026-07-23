package com.vnshop.paymentservice.infrastructure.gateway;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentGatewayPort;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CodPaymentMethodHandlerTest {

    @Test
    void createsAwaitingCollectionPaymentWithoutTreatingBuyerSelectionAsCapture() {
        UUID paymentId = UUID.randomUUID();
        Payment payment = new Payment(
                paymentId,
                "ORDER-1",
                "BUYER-1",
                new BigDecimal("125000"),
                PaymentMethod.COD,
                PaymentStatus.PENDING,
                null,
                Instant.parse("2026-07-24T10:00:00Z"));

        PaymentGatewayPort.GatewayPaymentResult result = new CodPaymentMethodHandler().processPayment(payment);

        assertThat(result.status()).isEqualTo(PaymentStatus.AWAITING_COLLECTION);
        assertThat(result.transactionRef()).isEqualTo("COD-" + paymentId);
    }
}
