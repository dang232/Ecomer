package com.vnshop.orderservice.domain.port.out;

import com.vnshop.orderservice.domain.Money;

public interface PaymentRequestPort {
    void requestPayment(String orderId, String buyerId, String paymentMethod, Money amount);
}
