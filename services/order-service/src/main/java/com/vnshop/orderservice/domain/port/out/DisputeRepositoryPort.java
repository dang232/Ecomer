package com.vnshop.orderservice.domain.port.out;

import com.vnshop.orderservice.domain.Dispute;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DisputeRepositoryPort {
    Dispute save(Dispute dispute);

    Optional<Dispute> findById(UUID disputeId);

    List<Dispute> findByStatus(String status);

    default List<Dispute> findByStatus(String status, String query) {
        return findByStatus(status);
    }

    Optional<Dispute> findByReturnId(String returnId);
}
