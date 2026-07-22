package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.AdminOrderUseCase;
import com.vnshop.orderservice.application.AdminRefundUseCase;
import com.vnshop.orderservice.domain.projection.OrderSummaryProjection;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;

@RestController
@RequestMapping("/admin/orders")
@PreAuthorize("hasRole('ADMIN')")
public class AdminOrderController {

    private final AdminOrderUseCase adminOrderUseCase;
    private final AdminRefundUseCase adminRefundUseCase;

    public AdminOrderController(AdminOrderUseCase adminOrderUseCase, AdminRefundUseCase adminRefundUseCase) {
        this.adminOrderUseCase = adminOrderUseCase;
        this.adminRefundUseCase = adminRefundUseCase;
    }

    @GetMapping
    public ApiResponse<Page<OrderSummaryProjection>> listOrders(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 50, sort = "createdAt") Pageable pageable
    ) {
        return ApiResponse.ok(adminOrderUseCase.listAllOrders(q, status, pageable));
    }

    @GetMapping("/by-buyer/{buyerId}")
    public ApiResponse<List<OrderSummaryProjection>> listOrdersByBuyer(@PathVariable String buyerId) {
        return ApiResponse.ok(adminOrderUseCase.listOrdersByBuyer(buyerId));
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<OrderResponse> cancel(@PathVariable UUID id) {
        return ApiResponse.ok(OrderResponse.fromDomain(adminOrderUseCase.forceCancel(id)));
    }

    @PostMapping("/{id}/refund")
    public ApiResponse<AdminRefundResponse> refund(
            @PathVariable UUID id,
            @Valid @RequestBody AdminRefundRequest request) {
        return ApiResponse.ok(AdminRefundResponse.fromDomain(adminRefundUseCase.refund(id, request.reason())));
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<OrderResponse> changeStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body
    ) {
        String status = body.get("status");
        if (status == null || status.isBlank()) {
            return ApiResponse.error("status field is required", "VALIDATION_ERROR");
        }
        return ApiResponse.ok(OrderResponse.fromDomain(adminOrderUseCase.changeStatus(id, status)));
    }
}
