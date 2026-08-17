package com.vnshop.shippingservice.domain.port.out;

import com.vnshop.shippingservice.domain.model.ShippingLabelRecord;

import java.util.List;

public interface ShippingLabelRepositoryPort {
    ShippingLabelRecord save(ShippingLabelRecord label);

    List<ShippingLabelRecord> findCreatedByOrderId(String orderId);

    void markCancelled(String orderId, String trackingCode);

    static ShippingLabelRepositoryPort noop() {
        return new ShippingLabelRepositoryPort() {
            @Override
            public ShippingLabelRecord save(ShippingLabelRecord label) {
                return label;
            }

            @Override
            public List<ShippingLabelRecord> findCreatedByOrderId(String orderId) {
                return List.of();
            }

            @Override
            public void markCancelled(String orderId, String trackingCode) {
                // Local test/stub mode has no durable database.
            }
        };
    }
}
