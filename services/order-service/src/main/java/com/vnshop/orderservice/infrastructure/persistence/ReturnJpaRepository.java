package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class ReturnJpaRepository implements ReturnRepositoryPort {
 private final ReturnJpaSpringDataRepository springDataRepository;

 public ReturnJpaRepository(ReturnJpaSpringDataRepository springDataRepository) {
 this.springDataRepository = springDataRepository;
  }

 @Override
 public Return save(Return orderReturn) {
 return springDataRepository.save(ReturnJpaEntity.fromDomain(orderReturn)).toDomain();
 }

 @Override
 public Optional<Return> findById(UUID returnId) {
 return springDataRepository.findById(returnId).map(ReturnJpaEntity::toDomain);
 }

 @Override
  public List<Return> findByBuyerId(String buyerId) {
 return springDataRepository.findByBuyerId(buyerId).stream().map(ReturnJpaEntity::toDomain).toList();
 }

 @Override
 public List<Return> findBySellerId(String sellerId) {
 return springDataRepository.findBySellerId(sellerId).stream().map(ReturnJpaEntity::toDomain).toList();
 }

 @Override
 public Optional<Return> findBySubOrderId(Long subOrderId) {
 return springDataRepository.findBySubOrderId(subOrderId).map(ReturnJpaEntity::toDomain);
 }
}
