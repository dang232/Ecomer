package com.vnshop.userservice.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class BuyerProfile {
    private static final int MAX_ADDRESSES = 5;

    private final String keycloakId;
    private String name;
    private PhoneNumber phone;
    private String avatarUrl;
    private boolean banned;
    private final List<Address> addresses;

    public BuyerProfile(String keycloakId, String name, PhoneNumber phone, String avatarUrl, List<Address> addresses) {
        this(keycloakId, name, phone, avatarUrl, false, addresses);
    }

    public BuyerProfile(String keycloakId, String name, PhoneNumber phone, String avatarUrl, boolean banned, List<Address> addresses) {
        this.keycloakId = requireNonBlank(keycloakId, "keycloakId");
        this.name = name;
        this.phone = phone;
        this.avatarUrl = avatarUrl;
        this.banned = banned;
        this.addresses = new ArrayList<>();
        if (addresses != null) {
            if (addresses.size() > MAX_ADDRESSES) {
                throw new IllegalArgumentException("buyer profile cannot have more than 5 addresses");
            }
            addresses.forEach(this::addAddress);
        }
    }

    public static BuyerProfile createDefault(String keycloakId) {
        return new BuyerProfile(keycloakId, null, null, null, List.of());
    }

    public String keycloakId() {
        return keycloakId;
    }

    public String name() {
        return name;
    }

    public PhoneNumber phone() {
        return phone;
    }

    public String avatarUrl() {
        return avatarUrl;
    }

    public List<Address> addresses() {
        return List.copyOf(addresses);
    }

    public boolean banned() {
        return banned;
    }

    public void ban() {
        this.banned = true;
    }

    public void unban() {
        this.banned = false;
    }

    public void updateProfile(String name, PhoneNumber phone, String avatarUrl) {
        this.name = name;
        this.phone = phone;
        this.avatarUrl = avatarUrl;
    }

    public void addAddress(Address address) {
        Objects.requireNonNull(address, "address is required");
        if (addresses.size() >= MAX_ADDRESSES) {
            throw new IllegalArgumentException("buyer profile cannot have more than 5 addresses");
        }
        addresses.add(address);
    }

    public void removeAddress(Address address) {
        addresses.remove(address);
    }

    private static String requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return value;
    }
}
