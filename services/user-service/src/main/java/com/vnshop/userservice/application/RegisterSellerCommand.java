package com.vnshop.userservice.application;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Command for registering a new seller profile. No longer carries the
 * raw {@code bankAccount} — that arrives separately via the destination
 * enrollment endpoint so the rest of the system never sees plaintext.
 */
public record RegisterSellerCommand(
        @NotBlank String keycloakId,
        @NotBlank @Size(min = 2, max = 120) String shopName,
        @NotBlank @Size(min = 2, max = 120) String bankName
) {
}
