package com.vnshop.userservice.application;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Input for enrolling (or re-enrolling) a seller's payout destination.
 * Carries the raw bank account number - this is the only place it is
 * ever accepted. The controller never logs it and the use case never
 * persists the raw value.
 */
public record EnrollDestinationCommand(
        @NotBlank String sellerId,
        @NotBlank @Size(min = 2, max = 120) String bankName,
        @NotBlank
        @Size(min = 4, max = 32)
        @Pattern(regexp = "^[0-9A-Za-z\\-]+$", message = "bankAccount must contain only digits, letters, or hyphens")
        String bankAccount
) {
    @Override
    public String toString() {
        return "EnrollDestinationCommand[sellerId=" + sellerId
                + ", bankName=" + bankName
                + ", bankAccount=REDACTED]";
    }
}
