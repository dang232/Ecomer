package com.vnshop.inventoryservice.application;

public class FlashSaleOutOfStockException extends RuntimeException {
    public FlashSaleOutOfStockException(String productId) {
        super("flash-sale product is out of stock: " + productId);
    }
}
