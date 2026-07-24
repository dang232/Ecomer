package com.vnshop.paymentservice.application.chargeback;

import com.vnshop.paymentservice.domain.Chargeback;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ChargebackResolvedEvent(
        UUID chargebackId,
        String orderId,
        String externalChargebackId,
        String provider,
        String outcome,
        BigDecimal challengedAmount,
        String currency,
        String providerPaymentId,
        LocalDate dueDate) {

    public static ChargebackResolvedEvent from(Chargeback cb) {
        return new ChargebackResolvedEvent(cb.id(), cb.orderId(), cb.externalChargebackId(), cb.provider().name(),
                cb.status().name(), cb.challengedAmount(), cb.currency(), cb.providerPaymentId(), cb.dueDate());
    }
}
