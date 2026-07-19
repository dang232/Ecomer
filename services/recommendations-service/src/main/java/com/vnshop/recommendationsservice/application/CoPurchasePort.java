package com.vnshop.recommendationsservice.application;

import java.util.List;
import java.util.Optional;

public interface CoPurchasePort {
    Optional<CoPurchase> find(String productA, String productB);

    CoPurchase save(CoPurchase coPurchase);

    List<CoPurchase> findTopByProductA(String productA, int limit);
}
