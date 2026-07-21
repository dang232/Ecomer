package com.vnshop.productservice.domain.port.out;

import com.vnshop.productservice.domain.ProductEvent;

/** Persists lifecycle events in the transaction that changes the product. */
public interface ProductEventOutboxPort {
    void enqueue(ProductEvent event);
}
