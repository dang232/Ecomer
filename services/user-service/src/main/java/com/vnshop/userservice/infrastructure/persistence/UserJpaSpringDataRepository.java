package com.vnshop.userservice.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface UserJpaSpringDataRepository extends JpaRepository<BuyerProfileJpaEntity, Long> {
    @EntityGraph(attributePaths = {"addresses"})
    Optional<BuyerProfileJpaEntity> findByKeycloakId(String keycloakId);

    @EntityGraph(attributePaths = {"addresses"})
    @Query("select b from BuyerProfileJpaEntity b where b.keycloakId in :ids")
    List<BuyerProfileJpaEntity> findByKeycloakIdIn(@Param("ids") List<String> ids);

    @Query("select seller from SellerProfileJpaEntity seller where seller.keycloakId = :sellerId")
    Optional<SellerProfileJpaEntity> findSellerEntityById(@Param("sellerId") String sellerId);

    @Query("select seller from SellerProfileJpaEntity seller where seller.approved = false")
    List<SellerProfileJpaEntity> findPendingSellerEntities();

    @Query("select b from BuyerProfileJpaEntity b where (:phone is not null and :phone <> '' and b.phone like %:phone%)")
    List<BuyerProfileJpaEntity> searchByPhone(@Param("phone") String phone);
}
