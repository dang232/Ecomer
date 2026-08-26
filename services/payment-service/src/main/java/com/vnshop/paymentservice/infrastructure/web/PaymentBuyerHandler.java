package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.application.GetPaymentStatusUseCase;
import com.vnshop.paymentservice.application.PaymentMethodInput;
import com.vnshop.paymentservice.infrastructure.gateway.VietQrService;

import java.util.Optional;

final class PaymentBuyerHandler {
    private final PaymentOperationRegistry registry;
    private final GetPaymentStatusUseCase statusUseCase;
    private final Optional<VietQrService> vietQrService;

    PaymentBuyerHandler(PaymentOperationRegistry registry, GetPaymentStatusUseCase statusUseCase,
            Optional<VietQrService> vietQrService) {
        this.registry = registry;
        this.statusUseCase = statusUseCase;
        this.vietQrService = vietQrService;
    }

    ApiResponse<PaymentResponse> create(PaymentRequest request, PaymentMethodInput method, String idempotencyKey) {
        return ApiResponse.ok(PaymentResponse.fromDomain(
                registry.processOrReuse(request.orderId(), method, idempotencyKey)));
    }

    ApiResponse<PaymentResponse> status(String orderId) {
        return ApiResponse.ok(PaymentResponse.fromDomain(
                statusUseCase.getByOrderIdForBuyer(orderId,
                        com.vnshop.paymentservice.infrastructure.config.JwtPrincipalUtil.currentUserId())));
    }
}
