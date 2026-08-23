package com.vnshop.userservice.infrastructure.web;

import java.util.List;

public record BuyerProfileResponse(String keycloakId, String email, String name, String phone, String avatarUrl, boolean banned, List<AddressResponse> addresses) {
}
