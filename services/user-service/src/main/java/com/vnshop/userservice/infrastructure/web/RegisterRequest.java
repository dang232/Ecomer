package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.domain.PhoneNumber;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8, max = 128) @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$", message = "Password must contain uppercase, lowercase and digit") String password,
        @NotBlank String firstName,
        @NotBlank String lastName,
        // Phone is optional. The DTO @Pattern composes the E.164 pattern from
        // the domain value object so the rule has one source of truth. The
        // FE does country-aware validation via libphonenumber-js and formats
        // the number to E.164 before submitting, so the BE only checks the
        // shape here. The whitespace tolerance covers the FE's habit of
        // sending trailing whitespace from the input box; the controller
        // trims before constructing the PhoneNumber.
        @Pattern(
                regexp = "^(" + PhoneNumber.PATTERN_STR + ")?\\s*$",
                message = "phone must be in E.164 format, e.g. +84912345678"
        )
        String phone
) {
}
