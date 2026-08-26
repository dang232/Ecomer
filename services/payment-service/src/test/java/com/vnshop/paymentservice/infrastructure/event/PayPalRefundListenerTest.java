package com.vnshop.paymentservice.infrastructure.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.FxRatePort;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.infrastructure.paypal.PayPalGateway;
import com.vnshop.paymentservice.infrastructure.dlt.DurableDltService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import org.mockito.ArgumentCaptor;

class PayPalRefundListenerTest {

    private static final String CAPTURE_ID = "CAPTURE-1";
    private static final String ORDER_ID = "ORDER-99";
    private static final String RETURN_ID = "RETURN-7";
    private static final String SELLER_ID = "SELLER-42";

    private final PaymentRepositoryPort paymentRepository = mock(PaymentRepositoryPort.class);
    private final PayPalGateway gateway = mock(PayPalGateway.class);
    private final FxRatePort fxRatePort = (from, to) -> new BigDecimal("0.00004");
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @SuppressWarnings("unchecked")
    void issuesRefundAndPublishesPaymentRefundedForCompletedPayPalPayment() {
        Payment payment = paypalPayment(PaymentStatus.COMPLETED, CAPTURE_ID);
        when(paymentRepository.findByOrderId(ORDER_ID)).thenReturn(Optional.of(payment));
        when(gateway.refund(eq(CAPTURE_ID), any(BigDecimal.class), eq(RETURN_ID)))
                .thenReturn(new PayPalGateway.PayPalRefund("REFUND-1", CAPTURE_ID, "COMPLETED"));
        KafkaTemplate<String, Object> kafkaTemplate = mock(KafkaTemplate.class);
        when(kafkaTemplate.send(any(String.class), any(String.class), any()))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));

        PayPalRefundListener listener = new PayPalRefundListener(
                paymentRepository, gateway, fxRatePort, objectMapper, providerOf(kafkaTemplate), mock(DurableDltService.class));

        listener.onRefundRequested(envelope("100000", "VND"));

        verify(gateway).refund(eq(CAPTURE_ID), eq(new BigDecimal("4.00")), eq(RETURN_ID));
        ArgumentCaptor<PaymentRefundedEvent> captor = ArgumentCaptor.forClass(PaymentRefundedEvent.class);
        verify(kafkaTemplate).send(eq(PayPalRefundListener.REFUNDED_TOPIC), eq(ORDER_ID), captor.capture());
        // sellerId must propagate from the inbound event so seller-finance knows
        // which wallet to debit; the listener only forwards, never derives it.
        assertThat(captor.getValue().sellerId()).isEqualTo(SELLER_ID);
        assertThat(captor.getValue().refundId()).isEqualTo("REFUND-1");
        assertThat(captor.getValue().commissionTier()).isEqualTo("STANDARD");
    }

    @Test
    @SuppressWarnings("unchecked")
    void readsFlatPayloadShapeWhenEnvelopeIsAbsent() {
        Payment payment = paypalPayment(PaymentStatus.COMPLETED, CAPTURE_ID);
        when(paymentRepository.findByOrderId(ORDER_ID)).thenReturn(Optional.of(payment));
        when(gateway.refund(any(String.class), any(BigDecimal.class), any(String.class)))
                .thenReturn(new PayPalGateway.PayPalRefund("REFUND-2", CAPTURE_ID, "COMPLETED"));
        KafkaTemplate<String, Object> kafkaTemplate = mock(KafkaTemplate.class);
        when(kafkaTemplate.send(any(String.class), any(String.class), any()))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));

        PayPalRefundListener listener = new PayPalRefundListener(
                paymentRepository, gateway, fxRatePort, objectMapper, providerOf(kafkaTemplate), mock(DurableDltService.class));

        // Bare event payload (no outbox envelope)
        String flat = "{\"returnId\":\"" + RETURN_ID + "\",\"orderId\":\"" + ORDER_ID
                + "\",\"buyerId\":\"BUYER-1\",\"sellerId\":\"" + SELLER_ID
                + "\",\"amount\":\"100000\",\"currency\":\"VND\",\"commissionTier\":\"STANDARD\"}";
        listener.onRefundRequested(flat);

        verify(gateway).refund(eq(CAPTURE_ID), eq(new BigDecimal("4.00")), eq(RETURN_ID));
    }

    @Test
    @SuppressWarnings("unchecked")
    void skipsNonPayPalPaymentSilently() {
        Payment cod = new Payment(UUID.randomUUID(), ORDER_ID, "BUYER-1",
                new BigDecimal("100000"), PaymentMethod.COD, PaymentStatus.COMPLETED, "COD-REF",
                Instant.parse("2026-05-19T00:00:00Z"));
        when(paymentRepository.findByOrderId(ORDER_ID)).thenReturn(Optional.of(cod));
        KafkaTemplate<String, Object> kafkaTemplate = mock(KafkaTemplate.class);

        PayPalRefundListener listener = new PayPalRefundListener(
                paymentRepository, gateway, fxRatePort, objectMapper, providerOf(kafkaTemplate), mock(DurableDltService.class));

        listener.onRefundRequested(envelope("100000", "VND"));

        verifyNoInteractions(gateway);
        verify(kafkaTemplate, never()).send(any(String.class), any(String.class), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void skipsRefundWhenPaymentIsStillPending() {
        Payment pending = paypalPayment(PaymentStatus.PENDING, null);
        when(paymentRepository.findByOrderId(ORDER_ID)).thenReturn(Optional.of(pending));
        KafkaTemplate<String, Object> kafkaTemplate = mock(KafkaTemplate.class);

        PayPalRefundListener listener = new PayPalRefundListener(
                paymentRepository, gateway, fxRatePort, objectMapper, providerOf(kafkaTemplate), mock(DurableDltService.class));

        listener.onRefundRequested(envelope("100000", "VND"));

        verifyNoInteractions(gateway);
        verify(kafkaTemplate, never()).send(any(String.class), any(String.class), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void skipsRefundWhenCaptureIdMissing() {
        // Theoretical state — a COMPLETED payment without a captureId. Defensive
        // guard so we never call PayPal with a blank reference.
        Payment payment = paypalPayment(PaymentStatus.COMPLETED, "");
        when(paymentRepository.findByOrderId(ORDER_ID)).thenReturn(Optional.of(payment));
        KafkaTemplate<String, Object> kafkaTemplate = mock(KafkaTemplate.class);

        PayPalRefundListener listener = new PayPalRefundListener(
                paymentRepository, gateway, fxRatePort, objectMapper, providerOf(kafkaTemplate), mock(DurableDltService.class));

        listener.onRefundRequested(envelope("100000", "VND"));

        verifyNoInteractions(gateway);
        verify(kafkaTemplate, never()).send(any(String.class), any(String.class), any());
    }

    private static Payment paypalPayment(PaymentStatus status, String captureId) {
        return new Payment(UUID.fromString("00000000-0000-0000-0000-000000000777"),
                ORDER_ID, "BUYER-1", new BigDecimal("100000"),
                PaymentMethod.PAYPAL, status, captureId,
                Instant.parse("2026-05-19T00:00:00Z"));
    }

    private static String envelope(String amount, String currency) {
        // Mirrors what order-service's outbox writes: {"eventType":"payment.refund_requested","payload":"<inner json>"}
        String inner = "{\\\"returnId\\\":\\\"" + RETURN_ID + "\\\",\\\"orderId\\\":\\\"" + ORDER_ID
                + "\\\",\\\"buyerId\\\":\\\"BUYER-1\\\",\\\"sellerId\\\":\\\"" + SELLER_ID
                + "\\\",\\\"amount\\\":\\\"" + amount
                + "\\\",\\\"currency\\\":\\\"" + currency
                + "\\\",\\\"commissionTier\\\":\\\"STANDARD\\\"}";
        return "{\"eventType\":\"payment.refund_requested\",\"payload\":\"" + inner + "\"}";
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<KafkaTemplate<String, Object>> providerOf(KafkaTemplate<String, Object> template) {
        ObjectProvider<KafkaTemplate<String, Object>> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(template);
        return provider;
    }
}
