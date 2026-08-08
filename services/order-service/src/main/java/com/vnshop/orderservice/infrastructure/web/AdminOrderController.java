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
import org.springframework.beans.factory.annotation.Autowired;
import com.vnshop.orderservice.infrastructure.web.pagination.AdminCursorCodec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;

@RestController
@RequestMapping("/admin/orders")
@PreAuthorize("hasRole('ADMIN')")
public class AdminOrderController {

    private final AdminOrderUseCase adminOrderUseCase;
    private final AdminRefundUseCase adminRefundUseCase;
    private final AdminCursorCodec cursorCodec;

    @Autowired
    public AdminOrderController(AdminOrderUseCase adminOrderUseCase, AdminRefundUseCase adminRefundUseCase,
            AdminCursorCodec cursorCodec) {
        this.adminOrderUseCase = adminOrderUseCase;
        this.adminRefundUseCase = adminRefundUseCase;
        this.cursorCodec = cursorCodec;
    }

    public AdminOrderController(AdminOrderUseCase adminOrderUseCase, AdminRefundUseCase adminRefundUseCase) {
        this(adminOrderUseCase, adminRefundUseCase,
                new AdminCursorCodec("dev-only-change-me", java.time.Duration.ofHours(1), java.time.Clock.systemUTC()));
    }

    @GetMapping
    public ApiResponse<?> listOrders(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor,
            @PageableDefault(size = 50, sort = "createdAt") Pageable pageable
    ) {
        if (limit != null || cursor != null) return cursorPage(q, status, limit, cursor);
        return ApiResponse.ok(adminOrderUseCase.listAllOrders(q, status, pageable));
    }

    private ApiResponse<AdminCursorPage<OrderSummaryProjection>> cursorPage(String query, String status,
            Integer requestedLimit, String token) {
        int limit = requestedLimit == null ? 50 : requestedLimit;
        if (limit < 1 || limit > 100) throw new IllegalArgumentException("invalid_page_size");
        String filterHash = filterHash(query, status);
        Instant before = null;
        String idBefore = null;
        if (token != null) {
            var decoded = cursorCodec.decode(token, "admin-orders", filterHash, "createdAt:desc,id:desc");
            before = Instant.parse(decoded.sortKey());
            idBefore = decoded.uniqueId();
        }
        List<OrderSummaryProjection> rows = adminOrderUseCase.listAllOrdersCursor(query, status, before, idBefore, limit + 1);
        boolean hasMore = rows.size() > limit;
        List<OrderSummaryProjection> items = hasMore ? rows.subList(0, limit) : rows;
        String next = hasMore ? cursorCodec.encode(new AdminCursorCodec.Cursor("admin-orders", filterHash,
                "createdAt:desc,id:desc", items.getLast().createdAt().toString(), items.getLast().orderId(), null, null)) : null;
        return ApiResponse.ok(new AdminCursorPage<>(items, next, hasMore, limit,
                new AdminCursorPage.Sort("createdAt", "desc"), null));
    }

    private static String filterHash(String query, String status) {
        try {
            String scope = (query == null ? "" : query.trim().toLowerCase())
                    + "\u0000" + (status == null ? "" : status.trim().toUpperCase());
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(scope.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (java.security.NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
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
