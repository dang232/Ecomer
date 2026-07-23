package com.vnshop.orderservice.domain;

import java.math.BigDecimal;
import java.time.LocalDate;

public record RefundByDate(LocalDate date, BigDecimal amount) {
}
