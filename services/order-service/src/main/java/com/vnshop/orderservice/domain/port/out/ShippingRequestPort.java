package com.vnshop.orderservice.domain.port.out;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.ShippingDetails;
import com.vnshop.orderservice.domain.Money;

public interface ShippingRequestPort {
    void requestShipping(String orderId, SubOrder subOrder, Address shippingAddress);

    default void requestShipping(String orderId, SubOrder subOrder, Address shippingAddress,
                                 ShippingDetails shippingDetails) {
        requestShipping(orderId, subOrder, shippingAddress);
    }

    default void requestShipping(String orderId, SubOrder subOrder, Address shippingAddress,
                                 ShippingDetails shippingDetails, Money codAmount, Money declaredValue) {
        requestShipping(orderId, subOrder, shippingAddress, shippingDetails);
    }
}
