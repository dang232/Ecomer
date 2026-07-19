package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.CancelOrderCommand;
import com.vnshop.orderservice.application.CancelOrderUseCase;
import com.vnshop.orderservice.application.CheckoutOrderUseCase;
import com.vnshop.orderservice.application.CheckoutOrderUseCase.CheckoutOrderCommand;
import com.vnshop.orderservice.application.ConfirmDeliveryUseCase;
import com.vnshop.orderservice.application.ViewOrderUseCase;
import com.vnshop.orderservice.domain.port.out.OrderSummaryQueryPort;
import com.vnshop.orderservice.infrastructure.config.JwtPrincipalUtil;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/orders")
public class OrderController {
    private static final String IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

    private final CheckoutOrderUseCase checkoutOrderUseCase;
    private final CancelOrderUseCase cancelOrderUseCase;
    private final OrderSummaryQueryPort orderSummaryQueryPort;
    private final ViewOrderUseCase viewOrderUseCase;
    private final ConfirmDeliveryUseCase confirmDeliveryUseCase;

    public OrderController(CheckoutOrderUseCase checkoutOrderUseCase, CancelOrderUseCase cancelOrderUseCase,
            OrderSummaryQueryPort orderSummaryQueryPort, ViewOrderUseCase viewOrderUseCase,
            ConfirmDeliveryUseCase confirmDeliveryUseCase) {
        this.checkoutOrderUseCase = checkoutOrderUseCase;
        this.cancelOrderUseCase = cancelOrderUseCase;
        this.orderSummaryQueryPort = orderSummaryQueryPort;
        this.viewOrderUseCase = viewOrderUseCase;
        this.confirmDeliveryUseCase = confirmDeliveryUseCase;
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<OrderResponse> checkout(
            @RequestHeader(name = IDEMPOTENCY_KEY_HEADER) String idempotencyKey,
            @Valid @RequestBody CheckoutRequest request
    ) {
        return ApiResponse.ok(OrderResponse.fromDomain(checkoutOrderUseCase.checkout(new CheckoutOrderCommand(
                JwtPrincipalUtil.currentUserId(),
                request.shippingAddress().toDomain(),
                request.toLineItems(),
                idempotencyKey,
                request.paymentMethod(),
                request.couponCode()))));
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public ApiResponse<Page<OrderListItemResponse>> list(
            @RequestParam(name = "status", required = false) String status,
            Pageable pageable
    ) {
        return ApiResponse.ok(
            orderSummaryQueryPort.findByBuyerId(JwtPrincipalUtil.currentUserId(), status, pageable)
                .map(OrderListItemResponse::fromProjection)
        );
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{id}")
    public ApiResponse<OrderResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(OrderResponse.fromDomain(
                viewOrderUseCase.viewForBuyer(id, JwtPrincipalUtil.currentUserId())));
    }

    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/{id}/cancel")
    public ApiResponse<OrderResponse> cancel(@PathVariable UUID id) {
        return ApiResponse.ok(OrderResponse.fromDomain(cancelOrderUseCase.cancel(new CancelOrderCommand(id, JwtPrincipalUtil.currentUserId()))));
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{orderId}/sub-orders/{subOrderId}/confirm-delivery")
    public ApiResponse<Void> confirmDelivery(
            @PathVariable UUID orderId,
            @PathVariable Long subOrderId) {
        confirmDeliveryUseCase.confirm(orderId, subOrderId, JwtPrincipalUtil.currentUserId());
        return ApiResponse.ok(null);
    }

}
