package com.vnshop.userservice.infrastructure.persistence;

import com.vnshop.userservice.application.PhoneAlreadyRegisteredException;
import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.PhoneNumber;
import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Optional;
import java.util.Objects;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

/**
 * EntityManager is constructor-injected with {@link Lazy} so the bean can be
 * instantiated in test contexts that exclude JPA autoconfiguration. The real
 * persistence calls still resolve the EntityManager from the application
 * context at first use.
 */
@Repository
public class UserJpaRepository implements UserRepositoryPort {
    private static final String PHONE_CLAIM_UNIQUE_INDEX = "uq_buyer_profiles_phone_claim";

    private final EntityManager entityManager;

    public UserJpaRepository(@Lazy EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    @Transactional
    public BuyerProfile saveBuyer(BuyerProfile buyerProfile) {
        BuyerProfileJpaEntity entity = BuyerProfileJpaEntity.fromDomain(buyerProfile);
        Optional<BuyerProfileJpaEntity> existing = findBuyerEntityByKeycloakId(buyerProfile.keycloakId());
        existing.ifPresent(current -> {
            entity.setId(current.getId());
            entity.setPhoneClaim(Objects.equals(current.getPhone(), entity.getPhone())
                    ? current.getPhoneClaim()
                    : entity.getPhone());
        });
        if (existing.isEmpty()) {
            entity.setPhoneClaim(entity.getPhone());
        }
        try {
            BuyerProfileJpaEntity persisted = entityManager.merge(entity);
            // Force the unique claim check inside this transaction so callers
            // can return the stable phone_taken contract instead of a commit-time 500.
            entityManager.flush();
            return persisted.toDomain();
        } catch (RuntimeException exception) {
            if (violatedPhoneClaimUniqueIndex(exception)) {
                throw new PhoneAlreadyRegisteredException();
            }
            throw exception;
        }
    }

    @Override
    public Optional<BuyerProfile> findBuyerByKeycloakId(String keycloakId) {
        return findBuyerEntityByKeycloakId(keycloakId).map(BuyerProfileJpaEntity::toDomain);
    }

    @Override
    public Optional<BuyerProfile> findBuyerByPhone(PhoneNumber phone) {
        if (phone == null) {
            return Optional.empty();
        }
        return entityManager.createQuery(
                        "select distinct buyer from BuyerProfileJpaEntity buyer left join fetch buyer.addresses "
                                + "where buyer.phone = :phone",
                        BuyerProfileJpaEntity.class
                )
                .setParameter("phone", phone.value())
                .getResultStream()
                .findFirst()
                .map(BuyerProfileJpaEntity::toDomain);
    }

    @Override
    public List<BuyerProfile> findBuyersByKeycloakIds(List<String> keycloakIds) {
        if (keycloakIds == null || keycloakIds.isEmpty()) {
            return List.of();
        }
        // No `left join fetch` for addresses — public-profile callers only
        // care about name + avatarUrl, and pulling addresses for batches of
        // potentially-hundreds of buyers would cartesian-explode the result.
        return entityManager.createQuery(
                        "select buyer from BuyerProfileJpaEntity buyer where buyer.keycloakId in :keycloakIds",
                        BuyerProfileJpaEntity.class
                )
                .setParameter("keycloakIds", keycloakIds)
                .getResultList()
                .stream()
                .map(BuyerProfileJpaEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional
    public SellerProfile saveSeller(SellerProfile sellerProfile) {
        SellerProfileJpaEntity entity = SellerProfileJpaEntity.fromDomain(sellerProfile);
        findSellerEntityByKeycloakId(sellerProfile.id()).ifPresent(existing -> entity.setId(existing.getId()));
        return entityManager.merge(entity).toDomain();
    }

    @Override
    public Optional<SellerProfile> findSellerById(String sellerId) {
        return findSellerEntityByKeycloakId(sellerId).map(SellerProfileJpaEntity::toDomain);
    }

    @Override
    public List<SellerProfile> findSellersByIds(List<String> sellerIds) {
        if (sellerIds == null || sellerIds.isEmpty()) {
            return List.of();
        }
        return entityManager.createQuery(
                        "select seller from SellerProfileJpaEntity seller where seller.keycloakId in :sellerIds",
                        SellerProfileJpaEntity.class)
                .setParameter("sellerIds", sellerIds)
                .getResultList()
                .stream()
                .map(SellerProfileJpaEntity::toDomain)
                .toList();
    }

    @Override
    public List<SellerProfile> findPendingSellers() {
        return entityManager.createQuery(
                        "select seller from SellerProfileJpaEntity seller where seller.approved = false",
                        SellerProfileJpaEntity.class
                )
                .getResultList()
                .stream()
                .map(SellerProfileJpaEntity::toDomain)
                .toList();
    }

    @Override
    public List<SellerProfile> findPendingSellers(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase();
        String term = "%" + normalized + "%";
        return entityManager.createQuery(
                        "select seller from SellerProfileJpaEntity seller "
                                + "where seller.approved = false and (:term = '' "
                                + "or lower(seller.keycloakId) like :likeTerm "
                                + "or lower(seller.shopName) like :likeTerm "
                                + "or lower(seller.bankName) like :likeTerm) "
                                + "order by seller.createdAt desc",
                        SellerProfileJpaEntity.class)
                .setParameter("term", normalized)
                .setParameter("likeTerm", term)
                .setMaxResults(200)
                .getResultList()
                .stream()
                .map(SellerProfileJpaEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional
    public SellerProfile updateSeller(SellerProfile sellerProfile) {
        return saveSeller(sellerProfile);
    }

    @Override
    public List<SellerProfile> findApprovedSellers(int page, int size) {
        return entityManager.createQuery(
                        "select seller from SellerProfileJpaEntity seller where seller.approved = true order by seller.createdAt desc",
                        SellerProfileJpaEntity.class
                )
                .setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList()
                .stream()
                .map(SellerProfileJpaEntity::toDomain)
                .toList();
    }

    @Override
    public long countApprovedSellers() {
        return entityManager.createQuery(
                        "select count(seller) from SellerProfileJpaEntity seller where seller.approved = true",
                        Long.class
                )
                .getSingleResult();
    }

    @Override
    public Page<BuyerProfile> searchBuyers(String query, Pageable pageable) {
        if (query == null || query.isBlank()) {
            return Page.empty(pageable);
        }
        String term = "%" + query.trim().toLowerCase() + "%";
        String predicate = "where lower(coalesce(b.keycloakId, '')) like :term "
                + "or lower(coalesce(b.email, '')) like :term "
                + "or lower(coalesce(b.name, '')) like :term "
                + "or lower(coalesce(b.phone, '')) like :term";
        long total = entityManager.createQuery(
                        "select count(b) from BuyerProfileJpaEntity b " + predicate,
                        Long.class
                )
                .setParameter("term", term)
                .getSingleResult();
        List<BuyerProfile> content = entityManager.createQuery(
                        "select b from BuyerProfileJpaEntity b " + predicate + " order by lower(coalesce(b.name, '')) asc, b.keycloakId asc",
                        BuyerProfileJpaEntity.class
                )
                .setParameter("term", term)
                .setFirstResult((int) pageable.getOffset())
                .setMaxResults(pageable.getPageSize())
                .getResultList()
                .stream()
                .map(BuyerProfileJpaEntity::toDomain)
                .toList();
        return new PageImpl<>(content, pageable, total);
    }

    @Override
    @Transactional
    public void anonymize(String keycloakId) {
        findBuyerEntityByKeycloakId(keycloakId).ifPresent(entity -> {
            entity.setName("[REDACTED]");
            entity.setPhone(null);
            entity.setPhoneClaim(null);
            entity.setAvatarUrl(null);
            entity.getAddresses().clear();
            entityManager.merge(entity);
        });
    }

    private Optional<BuyerProfileJpaEntity> findBuyerEntityByKeycloakId(String keycloakId) {
        return entityManager.createQuery(
                        "select buyer from BuyerProfileJpaEntity buyer left join fetch buyer.addresses where buyer.keycloakId = :keycloakId",
                        BuyerProfileJpaEntity.class
                )
                .setParameter("keycloakId", keycloakId)
                .getResultStream()
                .findFirst();
    }

    private boolean violatedPhoneClaimUniqueIndex(Throwable exception) {
        Throwable current = exception;
        while (current != null) {
            if (current instanceof ConstraintViolationException violation
                    && PHONE_CLAIM_UNIQUE_INDEX.equals(violation.getConstraintName())) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private Optional<SellerProfileJpaEntity> findSellerEntityByKeycloakId(String keycloakId) {
        return entityManager.createQuery(
                        "select seller from SellerProfileJpaEntity seller where seller.keycloakId = :keycloakId",
                        SellerProfileJpaEntity.class
                )
                .setParameter("keycloakId", keycloakId)
                .getResultStream()
                .findFirst();
    }
}
