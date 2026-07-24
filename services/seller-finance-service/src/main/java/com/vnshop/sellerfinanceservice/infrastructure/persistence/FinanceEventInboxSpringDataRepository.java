package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinanceEventInboxSpringDataRepository extends JpaRepository<FinanceEventInboxJpaEntity, UUID> {
}
