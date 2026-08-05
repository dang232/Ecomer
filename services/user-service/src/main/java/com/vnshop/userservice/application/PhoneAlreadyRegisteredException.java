package com.vnshop.userservice.application;

/** Raised when a phone number is already claimed by another buyer profile. */
public final class PhoneAlreadyRegisteredException extends RuntimeException {

    public PhoneAlreadyRegisteredException() {
        super("An account with that phone number already exists");
    }
}
