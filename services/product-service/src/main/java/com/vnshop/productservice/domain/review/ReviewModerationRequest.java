package com.vnshop.productservice.domain.review;

import java.util.List;

public record ReviewModerationRequest(
        String text,
        int rating,
        boolean verifiedPurchase,
        List<String> images) {

    public ReviewModerationRequest {
        text = text == null ? "" : text;
        images = images == null ? List.of() : List.copyOf(images);
    }
}
