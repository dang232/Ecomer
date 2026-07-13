package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.Address;
import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class ManageAddressUseCase {
    private final UserRepositoryPort userRepositoryPort;

    public ManageAddressUseCase(UserRepositoryPort userRepositoryPort) {
        this.userRepositoryPort = Objects.requireNonNull(userRepositoryPort, "userRepositoryPort is required");
    }

    public BuyerProfile addAddress(String keycloakId, Address address) {
        BuyerProfile buyerProfile = findBuyer(keycloakId);
        buyerProfile.addAddress(address);
        return userRepositoryPort.saveBuyer(buyerProfile);
    }

    public BuyerProfile removeAddress(String keycloakId, int addressIndex) {
        BuyerProfile buyerProfile = findBuyer(keycloakId);
        Address address = addressAt(buyerProfile, addressIndex);
        buyerProfile.removeAddress(address);
        return userRepositoryPort.saveBuyer(buyerProfile);
    }

    public BuyerProfile setDefaultAddress(String keycloakId, int addressIndex) {
        BuyerProfile buyerProfile = findBuyer(keycloakId);
        List<Address> existingAddresses = buyerProfile.addresses();
        addressAt(buyerProfile, addressIndex);
        List<Address> updatedAddresses = new ArrayList<>();
        for (int index = 0; index < existingAddresses.size(); index++) {
            Address address = existingAddresses.get(index);
            updatedAddresses.add(new Address(
                    address.street(),
                    address.ward(),
                    address.district(),
                    address.city(),
                    index == addressIndex
            ));
        }
        buyerProfile = new BuyerProfile(
                buyerProfile.keycloakId(),
                buyerProfile.name(),
                buyerProfile.phone(),
                buyerProfile.avatarUrl(),
                buyerProfile.banned(),
                updatedAddresses
        );
        return userRepositoryPort.saveBuyer(buyerProfile);
    }

    public BuyerProfile updateAddress(String keycloakId, int addressIndex, Address replacement) {
        BuyerProfile buyerProfile = findBuyer(keycloakId);
        addressAt(buyerProfile, addressIndex);

        List<Address> updatedAddresses = new ArrayList<>(buyerProfile.addresses());
        updatedAddresses.set(addressIndex, replacement);
        buyerProfile = new BuyerProfile(
                buyerProfile.keycloakId(),
                buyerProfile.name(),
                buyerProfile.phone(),
                buyerProfile.avatarUrl(),
                buyerProfile.banned(),
                updatedAddresses
        );
        return userRepositoryPort.saveBuyer(buyerProfile);
    }

    private BuyerProfile findBuyer(String keycloakId) {
        return userRepositoryPort.findBuyerByKeycloakId(keycloakId)
                .orElseThrow(() -> new IllegalArgumentException("buyer profile not found"));
    }

    private static Address addressAt(BuyerProfile buyerProfile, int addressIndex) {
        List<Address> addresses = buyerProfile.addresses();
        if (addressIndex < 0 || addressIndex >= addresses.size()) {
            throw new IllegalArgumentException("address index is invalid");
        }
        return addresses.get(addressIndex);
    }
}
