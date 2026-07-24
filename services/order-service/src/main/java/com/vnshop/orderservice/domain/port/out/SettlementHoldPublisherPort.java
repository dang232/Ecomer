package com.vnshop.orderservice.domain.port.out;

import java.util.UUID;

public interface SettlementHoldPublisherPort {
    void publish(UUID orderId, Long subOrderId, String holdType, boolean open);
}
