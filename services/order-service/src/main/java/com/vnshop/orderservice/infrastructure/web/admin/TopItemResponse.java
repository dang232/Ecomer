package com.vnshop.orderservice.infrastructure.web.admin;

import com.vnshop.orderservice.domain.TopItem;
import java.math.BigDecimal;

public record TopItemResponse(String id, String name, BigDecimal value) {
    static TopItemResponse fromDomain(TopItem item) {
        return new TopItemResponse(item.id(), item.name(), item.value());
    }
}
