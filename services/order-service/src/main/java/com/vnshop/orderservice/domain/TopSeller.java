package com.vnshop.orderservice.domain;

import java.math.BigDecimal;

public record TopSeller(String sellerId, String shopName, BigDecimal paidGmv) {
}
