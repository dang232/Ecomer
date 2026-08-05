package com.vnshop.productservice.domain.review;

public class ReviewEligibilityException extends RuntimeException {
    public ReviewEligibilityException() {
        super("You can only review products you have purchased and received");
    }
}
