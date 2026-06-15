package com.vnshop.productservice.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ObjectMetadataJpaSpringDataRepository extends JpaRepository<ObjectMetadataJpaEntity, String> {
}
