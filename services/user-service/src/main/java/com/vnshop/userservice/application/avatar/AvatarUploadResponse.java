package com.vnshop.userservice.application.avatar;

import java.net.URI;
import java.util.Map;

public record AvatarUploadResponse(
        String objectKey,
        URI uploadUrl,
        Map<String, String> uploadHeaders,
        long expiresInSeconds
) {
}
