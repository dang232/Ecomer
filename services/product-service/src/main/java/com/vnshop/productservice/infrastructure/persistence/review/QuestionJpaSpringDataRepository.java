package com.vnshop.productservice.infrastructure.persistence.review;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionJpaSpringDataRepository extends JpaRepository<QuestionJpaEntity, UUID> {
    List<QuestionJpaEntity> findByProductId(String productId);
}
