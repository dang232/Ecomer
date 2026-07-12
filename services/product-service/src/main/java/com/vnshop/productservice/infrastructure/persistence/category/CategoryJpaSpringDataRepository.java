package com.vnshop.productservice.infrastructure.persistence.category;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CategoryJpaSpringDataRepository extends JpaRepository<CategoryJpaEntity, String> {
}
