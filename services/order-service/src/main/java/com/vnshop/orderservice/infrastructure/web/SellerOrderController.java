package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.AcceptOrderUseCase;
import com.vnshop.orderservice.application.ListPendingOrdersUseCase;
import com.vnshop.orderservice.application.RejectOrderUseCase;
import com.vnshop.orderservice.application.ShipOrderCommand;
import com.vnshop.orderservice.application.ShipOrderUseCase;
import com.vnshop.orderservice.infrastructure.config.JwtPrincipalUtil;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/seller/orders")
public class SellerOrderController {
    private final ListPendingOrdersUseCase listPendingOrdersUseCase;
    private final AcceptOrderUseCase acceptOrderUseCase;
    private final RejectOrderUseCase rejectOrderUseCase;
    private final ShipOrderUseCase shipOrderUseCase;

    public SellerOrderController(
            ListPendingOrdersUseCase listPendingOrdersUseCase,
            AcceptOrderUseCase acceptOrderUseCase,
            RejectOrderUseCase rejectOrderUseCase,
            ShipOrderUseCase shipOrderUseCase
    ) {
        this.listPendingOrdersUseCase = listPendingOrdersUseCase;
        this.acceptOrderUseCase = acceptOrderUseCase;
        this.rejectOrderUseCase = rejectOrderUseCase;
        this.shipOrderUseCase = shipOrderUseCase;
    }

    @PreAuthorize("hasRole('SELLER')")
    @GetMapping("/pending")
    public ApiResponse<List<OrderResponse>> pending(@RequestParam(required = false) String q) {
        return ApiResponse.ok(listPendingOrdersUseCase.listPendingBySeller(JwtPrincipalUtil.currentSellerId(), q).stream()
                .map(OrderResponse::fromDomain)
                .toList());
    }

    @PreAuthorize("hasRole('SELLER')")
    @PutMapping("/{subOrderId}/accept")
    public ApiResponse<OrderResponse> accept(@PathVariable Long subOrderId) {
        String orderId = listPendingOrdersUseCase.orderIdFromSubOrderId(subOrderId);
        return ApiResponse.ok(OrderResponse.fromDomain(acceptOrderUseCase.accept(UUID.fromString(orderId), JwtPrincipalUtil.currentSellerId())));
    }

    @PreAuthorize("hasRole('SELLER')")
    @PutMapping("/{subOrderId}/reject")
    public ApiResponse<OrderResponse> reject(@PathVariable Long subOrderId) {
        String orderId = listPendingOrdersUseCase.orderIdFromSubOrderId(subOrderId);
        return ApiResponse.ok(OrderResponse.fromDomain(rejectOrderUseCase.reject(UUID.fromString(orderId), JwtPrincipalUtil.currentSellerId())));
    }

    @PreAuthorize("hasRole('SELLER')")
    @PutMapping("/{subOrderId}/ship")
    public ApiResponse<OrderResponse> ship(
            @PathVariable Long subOrderId,
            @Valid @RequestBody ShipRequest request
    ) {
        String orderId = listPendingOrdersUseCase.orderIdFromSubOrderId(subOrderId);
        ShipOrderCommand command = new ShipOrderCommand(
                UUID.fromString(orderId),
                JwtPrincipalUtil.currentSellerId(),
                request.carrier(),
                request.trackingNumber()
        );
        return ApiResponse.ok(OrderResponse.fromDomain(shipOrderUseCase.ship(command)));
    }
}
