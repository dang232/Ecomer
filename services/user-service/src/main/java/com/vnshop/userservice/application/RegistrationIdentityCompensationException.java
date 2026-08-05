package com.vnshop.userservice.application;

/**
 * Raised when profile creation fails after Keycloak user creation and the
 * compensating identity deletion also fails.
 */
public final class RegistrationIdentityCompensationException extends RuntimeException {

    public RegistrationIdentityCompensationException(Throwable cause) {
        super("Registration could not be completed safely", cause);
    }
}
