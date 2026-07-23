package com.vnshop.orderservice.infrastructure.web;

import jakarta.validation.constraints.NotBlank;

public record AdminRefundRequest(@NotBlank String reason) {
}
