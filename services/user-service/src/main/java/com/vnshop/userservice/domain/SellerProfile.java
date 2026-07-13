package com.vnshop.userservice.domain;

import java.time.Instant;
import java.util.Objects;

public class SellerProfile {
    private final String id;
    private String shopName;
    private String bankName;
    private String bankAccount;
    private Address pickupAddress;
    private boolean approved;
    private Tier tier;
    private boolean vacationMode;
    private String description;
    private String logoUrl;
    private String bannerUrl;
    private String rejectionReason;
    private final Instant createdAt;

    /** Existing 8-arg constructor — new fields default to null. All existing call sites unchanged. */
    public SellerProfile(
            String id,
            String shopName,
            String bankName,
            String bankAccount,
            Address pickupAddress,
            boolean approved,
            Tier tier,
            boolean vacationMode
    ) {
        this(id, shopName, bankName, bankAccount, pickupAddress, approved, tier, vacationMode,
                null, null, null, null);
    }

    /** Full constructor used by JPA toDomain mapping. */
    public SellerProfile(
            String id,
            String shopName,
            String bankName,
            String bankAccount,
            Address pickupAddress,
            boolean approved,
            Tier tier,
            boolean vacationMode,
            String description,
            String logoUrl,
            String bannerUrl,
            Instant createdAt
    ) {
        this.id = id;
        this.shopName = requireNonBlank(shopName, "shopName");
        this.bankName = requireNonBlank(bankName, "bankName");
        this.bankAccount = requireNonBlank(bankAccount, "bankAccount");
        this.pickupAddress = pickupAddress;
        this.approved = approved;
        this.tier = tier == null ? Tier.STANDARD : tier;
        this.vacationMode = vacationMode;
        this.description = description;
        this.logoUrl = logoUrl;
        this.bannerUrl = bannerUrl;
        this.createdAt = createdAt;
    }

    public String id() { return id; }
    public String shopName() { return shopName; }
    public String bankName() { return bankName; }
    public String bankAccount() { return bankAccount; }
    public Address pickupAddress() { return pickupAddress; }
    public boolean approved() { return approved; }
    public Tier tier() { return tier; }
    public boolean vacationMode() { return vacationMode; }
    public String description() { return description; }
    public String logoUrl() { return logoUrl; }
    public String bannerUrl() { return bannerUrl; }
    public String rejectionReason() { return rejectionReason; }
    public Instant createdAt() { return createdAt; }

    public void updateShop(String shopName, Address pickupAddress) {
        this.shopName = requireNonBlank(shopName, "shopName");
        this.pickupAddress = pickupAddress;
    }

    public void updateBankDetails(String bankName, String bankAccount) {
        this.bankName = requireNonBlank(bankName, "bankName");
        this.bankAccount = requireNonBlank(bankAccount, "bankAccount");
    }

    public void approve() {
        this.approved = true;
    }

    public void reject(String reason) {
        this.approved = false;
        this.rejectionReason = reason;
    }

    public void changeTier(Tier tier) {
        this.tier = Objects.requireNonNull(tier, "tier is required");
    }

    public void setVacationMode(boolean vacationMode) {
        this.vacationMode = vacationMode;
    }

    public SellerProfile withRejectionReason(String reason) {
        this.rejectionReason = reason;
        return this;
    }

    private static String requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return value;
    }
}
