package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.application.OrderAccessDeniedException;
import com.vnshop.paymentservice.application.PaymentMethodInput;
import com.vnshop.paymentservice.application.ProcessPaymentCommand;
import com.vnshop.paymentservice.application.ProcessPaymentUseCase;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.infrastructure.config.JwtPrincipalUtil;

import java.util.Optional;

final class PaymentOperationRegistry {
    private final ProcessPaymentUseCase processPaymentUseCase;
    private final PaymentRepositoryPort paymentRepository;

    PaymentOperationRegistry(ProcessPaymentUseCase processPaymentUseCase, PaymentRepositoryPort paymentRepository) {
        this.processPaymentUseCase = processPaymentUseCase;
        this.paymentRepository = paymentRepository;
    }

    Payment processOrReuse(String orderId, PaymentMethodInput method, String idempotencyKey) {
        String buyerId = JwtPrincipalUtil.currentUserId();
        Optional<Payment> existing = paymentRepository.findByOrderId(orderId);
        if (existing.isPresent()) {
            Payment payment = existing.get();
            if (!buyerId.equals(payment.buyerId()) || !method.name().equals(payment.method().name())) {
                throw new OrderAccessDeniedException("not authorized to use this payment");
            }
            return payment;
        }
        return processPaymentUseCase.process(new ProcessPaymentCommand(orderId, buyerId, method, idempotencyKey));
    }
}
