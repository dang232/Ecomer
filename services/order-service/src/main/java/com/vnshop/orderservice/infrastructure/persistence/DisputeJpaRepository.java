package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.Dispute;
import com.vnshop.orderservice.domain.DisputeStatus;
import com.vnshop.orderservice.domain.port.out.DisputeRepositoryPort;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;
import org.springframework.data.domain.PageRequest;
import com.vnshop.orderservice.domain.port.out.DisputeRepositoryPort.DisputeCursorItem;

@Repository
public class DisputeJpaRepository implements DisputeRepositoryPort {
 private final DisputeJpaSpringDataRepository springDataRepository;

 public DisputeJpaRepository(DisputeJpaSpringDataRepository springDataRepository) {
 this.springDataRepository = springDataRepository;
 }

 @Override
 public Dispute save(Dispute dispute) {
 return springDataRepository.save(DisputeJpaEntity.fromDomain(dispute)).toDomain();
 }

 @Override
 public Optional<Dispute> findById(UUID disputeId) {
 return springDataRepository.findById(disputeId).map(DisputeJpaEntity::toDomain);
 }

 @Override
 public List<Dispute> findByStatus(String status) {
 return springDataRepository.findByStatus(DisputeStatus.valueOf(status)).stream().map(DisputeJpaEntity::toDomain).toList();
 }

 @Override
 public List<Dispute> findByStatus(String status, String query) {
 String normalized = query == null ? "" : query.trim().toLowerCase();
   return springDataRepository.findByStatusAndQuery(DisputeStatus.valueOf(status), normalized, normalized + "%")
         .stream().map(DisputeJpaEntity::toDomain).toList();
 }

 @Override
  public Optional<Dispute> findByReturnId(String returnId) {
 UUID returnUuid;
 try {
 returnUuid = UUID.fromString(returnId);
 } catch (IllegalArgumentException ex) {
 return Optional.empty();
 }
  return springDataRepository.findByReturnId(returnUuid).map(DisputeJpaEntity::toDomain);
  }

  @Override
  public List<DisputeCursorItem> findCursor(String status, String query, Instant createdAtBefore,
          UUID disputeIdBefore, int limitPlusOne) {
  String normalized = query == null ? "" : query.trim().toLowerCase();
   var rows = createdAtBefore == null && disputeIdBefore == null
           ? springDataRepository.findCursorFirst(DisputeStatus.valueOf(status), normalized, normalized + "%",
                   PageRequest.of(0, limitPlusOne))
           : springDataRepository.findCursorAfter(DisputeStatus.valueOf(status), normalized, normalized + "%",
                   createdAtBefore, disputeIdBefore, PageRequest.of(0, limitPlusOne));
   return rows.stream()
          .map(entity -> new DisputeCursorItem(entity.toDomain(), entity.getCreatedAt()))
          .toList();
  }
}
