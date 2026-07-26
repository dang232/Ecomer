package com.vnshop.userservice.infrastructure.persistence;

import com.vnshop.userservice.domain.Address;
import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.Tier;
import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination;
import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination.VerificationState;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "seller_profiles", schema = "user_svc")
@Getter
@Setter
public class SellerProfileJpaEntity extends BaseJpaEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String keycloakId;

    @Column(nullable = false)
    private String shopName;

    @Column(nullable = false)
    private String bankName;

    private String pickupAddressStreet;
    private String pickupAddressWard;
    private String pickupAddressDistrict;
    private String pickupAddressCity;
    private boolean pickupAddressDefault;

    @Column(nullable = false)
    private boolean approved;

    @Column(nullable = false)
    private String tier;

    @Column(nullable = false)
    private boolean vacationMode;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(name = "banner_url", length = 500)
    private String bannerUrl;

    @Column(columnDefinition = "TEXT")
    private String rejectionReason;

    // --- Destination (encrypted) ---
    @Column(name = "destination_id", length = 36)
    private String destinationId;

    @Column(name = "destination_fingerprint", length = 128)
    private String destinationFingerprint;

    @Column(name = "destination_ciphertext", columnDefinition = "TEXT")
    private String destinationCiphertext;

    @Column(name = "destination_key_version")
    private Integer destinationKeyVersion;

    @Column(name = "destination_algorithm", length = 32)
    private String destinationAlgorithm;

    @Column(name = "bank_account_last4", length = 4)
    private String bankAccountLast4;

    @Column(name = "verification_state", length = 16, nullable = false)
    private String verificationState = "PENDING";

    @Column(name = "destination_enrolled_at")
    private Instant destinationEnrolledAt;

    @Column(name = "destination_updated_at")
    private Instant destinationUpdatedAt;

    protected SellerProfileJpaEntity() {
    }

    public SellerProfileJpaEntity(String keycloakId, String shopName, String bankName, boolean approved, String tier, boolean vacationMode) {
        this.keycloakId = keycloakId;
        this.shopName = shopName;
        this.bankName = bankName;
        this.approved = approved;
        this.tier = tier;
        this.vacationMode = vacationMode;
    }

    static SellerProfileJpaEntity fromDomain(SellerProfile sellerProfile) {
        SellerProfileJpaEntity entity = new SellerProfileJpaEntity(
                sellerProfile.id(),
                sellerProfile.shopName(),
                sellerProfile.bankName(),
                sellerProfile.approved(),
                sellerProfile.tier().name(),
                sellerProfile.vacationMode()
        );
        entity.applyPickupAddress(sellerProfile.pickupAddress());
        entity.description = sellerProfile.description();
        entity.logoUrl = sellerProfile.logoUrl();
        entity.bannerUrl = sellerProfile.bannerUrl();
        entity.rejectionReason = sellerProfile.rejectionReason();
        entity.applyDestination(sellerProfile);
        return entity;
    }

    SellerProfile toDomain() {
        SellerProfile profile = new SellerProfile(
                keycloakId,
                shopName,
                bankName,
                pickupAddress(),
                approved,
                Tier.valueOf(tier),
                vacationMode,
                description,
                logoUrl,
                bannerUrl,
                getCreatedAt(),
                destinationFromColumns()
        );
        return profile.withRejectionReason(rejectionReason);
    }

    private void applyPickupAddress(Address pickupAddress) {
        if (pickupAddress == null) {
            return;
        }
        this.pickupAddressStreet = pickupAddress.street();
        this.pickupAddressWard = pickupAddress.ward();
        this.pickupAddressDistrict = pickupAddress.district();
        this.pickupAddressCity = pickupAddress.city();
        this.pickupAddressDefault = pickupAddress.isDefault();
    }

    private Address pickupAddress() {
        if (pickupAddressStreet == null || pickupAddressDistrict == null || pickupAddressCity == null) {
            return null;
        }
        return new Address(pickupAddressStreet, pickupAddressWard, pickupAddressDistrict, pickupAddressCity, pickupAddressDefault);
    }

    private void applyDestination(SellerProfile profile) {
        profile.destination().ifPresentOrElse(d -> {
            this.destinationId = d.destinationId();
            this.destinationFingerprint = d.fingerprint();
            this.destinationCiphertext = d.ciphertext();
            this.destinationKeyVersion = d.keyVersion();
            this.destinationAlgorithm = d.algorithm();
            this.bankAccountLast4 = d.bankAccountLast4();
            this.verificationState = d.verificationState().name();
            this.destinationEnrolledAt = d.enrolledAt();
            this.destinationUpdatedAt = d.updatedAt();
        }, () -> {
            this.destinationId = null;
            this.destinationFingerprint = null;
            this.destinationCiphertext = null;
            this.destinationKeyVersion = null;
            this.destinationAlgorithm = null;
            this.bankAccountLast4 = null;
            this.verificationState = "PENDING";
            this.destinationEnrolledAt = null;
            this.destinationUpdatedAt = null;
        });
    }

    private SellerPayoutDestination destinationFromColumns() {
        if (destinationId == null || destinationCiphertext == null) {
            return null;
        }
        VerificationState state;
        try {
            state = VerificationState.valueOf(verificationState == null ? "PENDING" : verificationState);
        } catch (IllegalArgumentException ex) {
            state = VerificationState.PENDING;
        }
        int keyVersion = destinationKeyVersion == null ? 0 : destinationKeyVersion;
        Instant enrolledAt = destinationEnrolledAt == null ? getCreatedAt() : destinationEnrolledAt;
        Instant updatedAt = destinationUpdatedAt == null ? getUpdatedAt() : destinationUpdatedAt;
        return new SellerPayoutDestination(
                destinationId,
                keycloakId,
                bankName,
                bankAccountLast4 == null ? "0000" : bankAccountLast4,
                destinationFingerprint == null ? "0" : destinationFingerprint,
                keyVersion,
                destinationAlgorithm == null ? SellerPayoutDestination.PERSISTED_ALGORITHM : destinationAlgorithm,
                destinationCiphertext,
                state,
                enrolledAt,
                updatedAt
        );
    }
}
