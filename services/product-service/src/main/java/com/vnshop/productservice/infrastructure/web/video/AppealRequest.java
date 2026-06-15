package com.vnshop.productservice.infrastructure.web.video;

/**
 * Appeal body for POST /api/v1/videos/{videoId}/appeal.
 */
public record AppealRequest(String reason) {
}
