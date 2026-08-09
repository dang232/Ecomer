package com.vnshop.userservice.domain.port.out;

import java.time.Instant;

public record AdminSellerCursor(Instant createdAt, String keycloakId) {}
