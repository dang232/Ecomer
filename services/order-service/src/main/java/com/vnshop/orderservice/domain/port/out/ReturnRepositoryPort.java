package com.vnshop.orderservice.domain.port.out;

import com.vnshop.orderservice.domain.Return;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReturnRepositoryPort {
    Return save(Return orderReturn);

    Optional<Return> findById(UUID returnId);

    List<Return> findByBuyerId(String buyerId);

    List<Return> findBySellerId(String sellerId);

    Optional<Return> findBySubOrderId(Long subOrderId);
}
