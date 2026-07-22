package com.vnshop.userservice.infrastructure.persistence;

import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.PhoneNumber;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "buyer_profiles", schema = "user_svc")
@Getter
@Setter
public class BuyerProfileJpaEntity extends BaseJpaEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String keycloakId;

    @Column(length = 320)
    private String email;

    private String name;

    private String phone;

    private String avatarUrl;

    @Column(nullable = false)
    private boolean banned = false;

    @OneToMany(mappedBy = "buyerProfile", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AddressJpaEntity> addresses = new ArrayList<>();

    protected BuyerProfileJpaEntity() {
    }

    public BuyerProfileJpaEntity(String keycloakId, String email, String name, String phone, String avatarUrl) {
        this.keycloakId = keycloakId;
        this.email = email;
        this.name = name;
        this.phone = phone;
        this.avatarUrl = avatarUrl;
        this.banned = false;
    }

    static BuyerProfileJpaEntity fromDomain(BuyerProfile buyerProfile) {
        BuyerProfileJpaEntity entity = new BuyerProfileJpaEntity(
                buyerProfile.keycloakId(),
                buyerProfile.email(),
                buyerProfile.name(),
                buyerProfile.phone() == null ? null : buyerProfile.phone().value(),
                buyerProfile.avatarUrl()
        );
        entity.banned = buyerProfile.banned();
        buyerProfile.addresses().forEach(address -> entity.addAddress(AddressJpaEntity.fromDomain(address)));
        return entity;
    }

    BuyerProfile toDomain() {
        return new BuyerProfile(
                keycloakId,
                email,
                name,
                phone == null ? null : new PhoneNumber(phone),
                avatarUrl,
                banned,
                addresses.stream().map(AddressJpaEntity::toDomain).toList()
        );
    }

    private void addAddress(AddressJpaEntity address) {
        address.setBuyerProfile(this);
        addresses.add(address);
    }
}
