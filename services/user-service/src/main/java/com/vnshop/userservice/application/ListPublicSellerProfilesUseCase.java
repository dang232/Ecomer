package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;

import java.util.List;
import java.util.Objects;

public class ListPublicSellerProfilesUseCase {
    private static final int MAX_BATCH = 100;

    private final UserRepositoryPort userRepositoryPort;

    public ListPublicSellerProfilesUseCase(UserRepositoryPort userRepositoryPort) {
        this.userRepositoryPort = Objects.requireNonNull(userRepositoryPort, "userRepositoryPort is required");
    }

    public List<SellerProfile> list(List<String> sellerIds) {
        if (sellerIds == null || sellerIds.isEmpty()) {
            return List.of();
        }
        List<String> bounded = sellerIds.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(id -> !id.isEmpty())
                .distinct()
                .limit(MAX_BATCH)
                .toList();
        return bounded.isEmpty() ? List.of() : userRepositoryPort.findSellersByIds(bounded);
    }
}
