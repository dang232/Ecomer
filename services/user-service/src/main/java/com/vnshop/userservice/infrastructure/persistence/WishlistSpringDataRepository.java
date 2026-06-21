package com.vnshop.userservice.infrastructure.persistence;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WishlistSpringDataRepository
        extends JpaRepository<WishlistItemJpaEntity, WishlistItemJpaEntity.WishlistItemId> {

    List<WishlistItemJpaEntity> findByIdKeycloakIdOrderByCreatedAtDesc(String keycloakId);

    boolean existsByIdKeycloakIdAndIdProductId(String keycloakId, String productId);

    @Modifying
    @Transactional
    @Query("delete from WishlistItemJpaEntity w where w.id.keycloakId = :keycloakId and w.id.productId = :productId")
    int deleteByKeycloakIdAndProductId(@Param("keycloakId") String keycloakId, @Param("productId") String productId);

    @Modifying
    @Transactional
    @Query("delete from WishlistItemJpaEntity w where w.id.keycloakId = :keycloakId")
    int deleteAllByKeycloakId(@Param("keycloakId") String keycloakId);

    int countByIdKeycloakId(String keycloakId);
}
