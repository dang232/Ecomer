package com.vnshop.userservice.domain;

import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination;
import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination.VerificationState;
import com.vnshop.userservice.domain.redaction.Redacted;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/**
 * Seller profile domain model.
 *
 * <p>Bank account details are no longer stored in plaintext. The
 * profile carries a {@link SellerPayoutDestination} reference (or
 * {@code null} when the seller has not yet enrolled a destination).
 * Plain-text fields were removed in the V10 migration.
 */
public class SellerProfile {
    private final String id;
    private String shopName;
    private String bankName; // public metadata (e.g. "Vietcombank")
    private Address pickupAddress;
    private boolean approved;
    private Tier tier;
    private boolean vacationMode;
    private String description;
    private String logoUrl;
    private String bannerUrl;
    private String rejectionReason;
    private final Instant createdAt;
    private SellerPayoutDestination destination;

    /** Existing 7-arg constructor — destination defaults to null. */
    public SellerProfile(
            String id,
            String shopName,
            String bankName,
            Address pickupAddress,
            boolean approved,
            Tier tier,
            boolean vacationMode
    ) {
        this(id, shopName, bankName, pickupAddress, approved, tier, vacationMode,
                null, null, null, null, null);
    }

    /** Full constructor used by JPA toDomain mapping. */
    public SellerProfile(
            String id,
            String shopName,
            String bankName,
            Address pickupAddress,
            boolean approved,
            Tier tier,
            boolean vacationMode,
            String description,
            String logoUrl,
            String bannerUrl,
            Instant createdAt,
            SellerPayoutDestination destination
    ) {
        this.id = id;
        this.shopName = requireNonBlank(shopName, "shopName");
        this.bankName = requireNonBlank(bankName, "bankName");
        this.pickupAddress = pickupAddress;
        this.approved = approved;
        this.tier = tier == null ? Tier.STANDARD : tier;
        this.vacationMode = vacationMode;
        this.description = description;
        this.logoUrl = logoUrl;
        this.bannerUrl = bannerUrl;
        this.createdAt = createdAt;
        this.destination = destination;
    }

    public String id() { return id; }
    public String shopName() { return shopName; }
    public String bankName() { return bankName; }
    public Address pickupAddress() { return pickupAddress; }
    public boolean approved() { return approved; }
    public Tier tier() { return tier; }
    public boolean vacationMode() { return vacationMode; }
    public String description() { return description; }
    public String logoUrl() { return logoUrl; }
    public String bannerUrl() { return bannerUrl; }
    public String rejectionReason() { return rejectionReason; }
    public Instant createdAt() { return createdAt; }
    public Optional<SellerPayoutDestination> destination() { return Optional.ofNullable(destination); }

    /**
     * Public, masked view of the destination bank name + last4 + state.
     * Safe to serialize into a browser-facing API.
     */
    public Optional<DestinationMask> destinationMask() {
        if (destination == null) {
            return Optional.empty();
        }
        return Optional.of(new DestinationMask(
                destination.destinationId(),
                destination.bankName(),
                Redacted.last4(destination.bankAccountLast4()),
                destination.verificationState().name()
        ));
    }

    public void updateShop(String shopName, Address pickupAddress) {
        this.shopName = requireNonBlank(shopName, "shopName");
        this.pickupAddress = pickupAddress;
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

    /**
     * Enroll (or replace) the seller's payout destination. The previous
     * destination (if any) is discarded; the immutable finance snapshot
     * taken by seller-finance-service before this call remains
     * unchanged because snapshots live in a separate domain.
     */
    public void enrollDestination(SellerPayoutDestination destination) {
        this.destination = Objects.requireNonNull(destination, "destination");
    }

    /** Returns true iff a verified destination is enrolled. */
    public boolean hasVerifiedDestination() {
        return destination != null && destination.verificationState() == VerificationState.VERIFIED;
    }

    @Override
    public String toString() {
        return "SellerProfile{" +
                "id='" + id + '\'' +
                ", shopName='" + shopName + '\'' +
                ", bankName='" + bankName + '\'' +
                ", approved=" + approved +
                ", tier=" + tier +
                ", destination=" + (destination == null ? "none" : Redacted.fingerprint(destination.fingerprint())) +
                '}';
    }

    /**
     * Public-facing destination summary. Last4 only - never plaintext.
     */
    public record DestinationMask(
            String destinationId,
            String bankName,
            String last4,
            String verificationState
    ) {}

    private static String requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return value;
    }
}
