package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.AdminRefundUseCase;
import java.util.List;
import java.util.UUID;

public record AdminRefundResponse(UUID orderId, List<UUID> returnIds) {
    static AdminRefundResponse fromDomain(AdminRefundUseCase.AdminRefundResult result) {
        return new AdminRefundResponse(result.orderId(), result.returnIds());
    }
}
