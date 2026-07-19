package com.vnshop.recommendationsservice.application;

public interface ProcessedOrderPort {
    boolean exists(String orderId);

    void save(String orderId);
}
