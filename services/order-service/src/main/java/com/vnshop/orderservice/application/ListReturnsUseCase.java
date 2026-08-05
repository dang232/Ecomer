package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;

import java.util.List;
import java.util.UUID;

public class ListReturnsUseCase {

    private final ReturnRepositoryPort returnRepositoryPort;

    public ListReturnsUseCase(ReturnRepositoryPort returnRepositoryPort) {
        this.returnRepositoryPort = returnRepositoryPort;
    }

    public List<Return> listByBuyerId(String buyerId) {
        return returnRepositoryPort.findByBuyerId(buyerId);
    }

    public List<Return> listBySellerId(String sellerId) {
        if (sellerId == null || sellerId.isBlank()) {
            throw new IllegalArgumentException("sellerId is required");
        }
        return returnRepositoryPort.findBySellerId(sellerId);
    }

    /**
     * Returns a single buyer-owned return. Missing and foreign returns share
     * the same not-found result so the detail route cannot be used to probe
     * another buyer's return history.
     */
    public Return findByIdForBuyer(UUID returnId, String buyerId) {
        if (returnId == null || buyerId == null || buyerId.isBlank()) {
            throw new ReturnNotFoundException();
        }
        return returnRepositoryPort.findById(returnId)
                .filter(orderReturn -> buyerId.equals(orderReturn.buyerId()))
                .orElseThrow(ReturnNotFoundException::new);
    }

    public static final class ReturnNotFoundException extends RuntimeException {
        public ReturnNotFoundException() {
            super("return not found");
        }
    }
}
