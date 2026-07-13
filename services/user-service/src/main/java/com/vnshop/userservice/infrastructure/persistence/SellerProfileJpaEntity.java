package com.vnshop.userservice.infrastructure.persistence;

import com.vnshop.userservice.domain.Address;
import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.Tier;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
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

    @Column(nullable = false)
    private String bankAccount;

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

    protected SellerProfileJpaEntity() {
    }

    public SellerProfileJpaEntity(String keycloakId, String shopName, String bankName, String bankAccount, boolean approved, String tier, boolean vacationMode) {
        this.keycloakId = keycloakId;
        this.shopName = shopName;
        this.bankName = bankName;
        this.bankAccount = bankAccount;
        this.approved = approved;
        this.tier = tier;
        this.vacationMode = vacationMode;
    }

    static SellerProfileJpaEntity fromDomain(SellerProfile sellerProfile) {
        SellerProfileJpaEntity entity = new SellerProfileJpaEntity(
                sellerProfile.id(),
                sellerProfile.shopName(),
                sellerProfile.bankName(),
                sellerProfile.bankAccount(),
                sellerProfile.approved(),
                sellerProfile.tier().name(),
                sellerProfile.vacationMode()
        );
        entity.applyPickupAddress(sellerProfile.pickupAddress());
        entity.description = sellerProfile.description();
        entity.logoUrl = sellerProfile.logoUrl();
        entity.bannerUrl = sellerProfile.bannerUrl();
        entity.rejectionReason = sellerProfile.rejectionReason();
        return entity;
    }

    SellerProfile toDomain() {
        return new SellerProfile(
                keycloakId,
                shopName,
                bankName,
                bankAccount,
                pickupAddress(),
                approved,
                Tier.valueOf(tier),
                vacationMode,
                description,
                logoUrl,
                bannerUrl,
                getCreatedAt()
        ).withRejectionReason(rejectionReason);
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
}
