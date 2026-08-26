package com.vnshop.paymentservice.application;

import com.vnshop.paymentservice.domain.Payment;
import java.time.Instant;

public record PaymentProcessingResult(Payment payment, boolean replayed, Instant processedAt) {
}
