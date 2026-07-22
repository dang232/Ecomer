package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.FullName;
import com.vnshop.userservice.domain.PhoneNumber;

/**
 * Typed input to {@link RegisterBuyerUseCase}. Phone and name are domain
 * value objects (not raw strings) so the use case body is a single
 * composition step with no re-validation or null/blank handling.
 */
public record RegisterBuyerCommand(
        String keycloakId,
        String email,
        FullName name,
        PhoneNumber phone,
        String avatarUrl
) {
    public RegisterBuyerCommand(String keycloakId, FullName name, PhoneNumber phone, String avatarUrl) {
        this(keycloakId, null, name, phone, avatarUrl);
    }
}
