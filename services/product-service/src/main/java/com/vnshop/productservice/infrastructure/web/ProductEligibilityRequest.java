package com.vnshop.productservice.infrastructure.web;

public record ProductEligibilityRequest(
        boolean sameDayDelivery,
        boolean verified,
        boolean isOfficial) {
}
