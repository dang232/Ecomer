package com.vnshop.orderservice.domain.checkout;

import java.math.BigDecimal;
import com.vnshop.orderservice.domain.ParcelDimensions;

public record CartItemSnapshot(String productId, String variantSku, String name, int quantity, BigDecimal unitPrice,
                               ParcelDimensions parcel) {
    public CartItemSnapshot(String productId, String variantSku, String name, int quantity, BigDecimal unitPrice) {
        this(productId, variantSku, name, quantity, unitPrice, null);
    }
    public BigDecimal total() {
        return unitPrice.multiply(BigDecimal.valueOf(quantity));
    }
}
