package com.vnshop.userservice.infrastructure.persistence;

import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.port.out.AdminBuyerCursor;
import com.vnshop.userservice.domain.port.out.AdminSellerCursor;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Repository;

@Repository
public class UserAdminCursorJpaRepository {
    private final EntityManager entityManager;

    public UserAdminCursorJpaRepository(@Lazy EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public List<BuyerProfile> searchBuyers(String query, AdminBuyerCursor cursor, int limit) {
        String normalized = normalize(query);
        String prefix = normalized + "%";
        String anchor = cursor == null ? "" : cursor.nameKey();
        String anchorId = cursor == null ? "" : cursor.keycloakId();
        String predicate = "where (lower(coalesce(b.keycloakId, '')) like :prefix "
                + "or lower(coalesce(b.email, '')) like :prefix "
                + "or lower(coalesce(b.name, '')) like :prefix "
                + "or lower(coalesce(b.phone, '')) like :prefix) "
                + "and (:hasAnchor = false or lower(coalesce(b.name, '')) > :anchor "
                + "or (lower(coalesce(b.name, '')) = :anchor and lower(coalesce(b.keycloakId, '')) > :anchorId))";
        return entityManager.createQuery("select b from BuyerProfileJpaEntity b " + predicate
                        + " order by lower(coalesce(b.name, '')) asc, lower(coalesce(b.keycloakId, '')) asc",
                        BuyerProfileJpaEntity.class)
                .setParameter("prefix", prefix)
                .setParameter("hasAnchor", cursor != null)
                .setParameter("anchor", anchor)
                .setParameter("anchorId", anchorId)
                .setMaxResults(limit)
                .getResultList().stream().map(BuyerProfileJpaEntity::toDomain).toList();
    }

    public List<SellerProfile> findPendingSellers(String query, AdminSellerCursor cursor, int limit) {
        String prefix = normalize(query) + "%";
        String anchorId = cursor == null ? "" : cursor.keycloakId();
        String predicate = "where seller.approved = false and (lower(coalesce(seller.keycloakId, '')) like :prefix "
                + "or lower(coalesce(seller.shopName, '')) like :prefix "
                + "or lower(coalesce(seller.bankName, '')) like :prefix) "
                + "and (:hasAnchor = false or seller.createdAt < :anchorTime "
                + "or (seller.createdAt = :anchorTime and lower(coalesce(seller.keycloakId, '')) < :anchorId))";
        return entityManager.createQuery("select seller from SellerProfileJpaEntity seller " + predicate
                        + " order by seller.createdAt desc, lower(coalesce(seller.keycloakId, '')) desc",
                        SellerProfileJpaEntity.class)
                .setParameter("prefix", prefix)
                .setParameter("hasAnchor", cursor != null)
                .setParameter("anchorTime", cursor == null ? java.time.Instant.MAX : cursor.createdAt())
                .setParameter("anchorId", anchorId)
                .setMaxResults(limit)
                .getResultList().stream().map(SellerProfileJpaEntity::toDomain).toList();
    }

    private static String normalize(String query) {
        return query == null ? "" : query.trim().toLowerCase(java.util.Locale.ROOT);
    }
}
