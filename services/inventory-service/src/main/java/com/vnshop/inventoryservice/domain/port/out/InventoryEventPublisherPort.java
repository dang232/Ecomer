package com.vnshop.inventoryservice.domain.port.out;

import java.util.List;

public interface InventoryEventPublisherPort {
    void publishReleased(String orderId, String sagaId, List<ReleasedItem> items);

    record ReleasedItem(String productId, int quantity) {}
}
