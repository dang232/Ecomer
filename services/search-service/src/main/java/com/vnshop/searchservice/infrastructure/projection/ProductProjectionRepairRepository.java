package com.vnshop.searchservice.infrastructure.projection;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductProjectionRepairRepository extends JpaRepository<ProductProjectionRepair, String> {
    List<ProductProjectionRepair> findAllByOrderByCreatedAtAsc(Pageable pageable);
}
