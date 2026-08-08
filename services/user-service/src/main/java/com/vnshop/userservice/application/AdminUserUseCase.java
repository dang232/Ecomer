package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.port.out.KeycloakAdminPort;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import com.vnshop.userservice.domain.port.out.AdminBuyerCursor;

import java.util.Objects;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;

public class AdminUserUseCase {

    private final UserRepositoryPort userRepository;
    private final KeycloakAdminPort keycloakAdmin;

    public AdminUserUseCase(UserRepositoryPort userRepository, KeycloakAdminPort keycloakAdmin) {
        this.userRepository = Objects.requireNonNull(userRepository, "userRepository is required");
        this.keycloakAdmin = Objects.requireNonNull(keycloakAdmin, "keycloakAdmin is required");
    }

    public Page<BuyerProfile> searchUsers(String query, Pageable pageable) {
        return userRepository.searchBuyers(query, pageable);
    }

    public List<BuyerProfile> searchUsersCursor(String query, AdminBuyerCursor cursor, int limit) {
        return userRepository.searchBuyersCursor(query, cursor, limit);
    }

    public BuyerProfile banUser(String keycloakId) {
        BuyerProfile profile = userRepository.findBuyerByKeycloakId(keycloakId)
                .orElseThrow(() -> new IllegalArgumentException("user not found: " + keycloakId));
        profile.ban();
        keycloakAdmin.disableUser(profile.keycloakId());
        return userRepository.saveBuyer(profile);
    }

    public BuyerProfile unbanUser(String keycloakId) {
        BuyerProfile profile = userRepository.findBuyerByKeycloakId(keycloakId)
                .orElseThrow(() -> new IllegalArgumentException("user not found: " + keycloakId));
        profile.unban();
        keycloakAdmin.enableUser(profile.keycloakId());
        return userRepository.saveBuyer(profile);
    }
}
