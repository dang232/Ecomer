package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.avatar.AvatarUploadResponse;

import java.net.URI;
import java.util.Map;

public record AvatarUploadHttpResponse(
        String objectKey,
        URI uploadUrl,
        Map<String, String> uploadHeaders,
        long expiresInSeconds) {
    static AvatarUploadHttpResponse fromDomain(AvatarUploadResponse response) {
        return new AvatarUploadHttpResponse(
                response.objectKey(),
                response.uploadUrl(),
                response.uploadHeaders(),
                response.expiresInSeconds());
    }
}
