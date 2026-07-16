package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class OrderJpaRepository implements OrderRepositoryPort {
    private final OrderJpaSpringDataRepository springDataRepository;

    public OrderJpaRepository(OrderJpaSpringDataRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public Order save(Order order) {
        return springDataRepository.save(OrderJpaEntity.fromDomain(order)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Order> findById(UUID orderId) {
        return springDataRepository.findByIdWithGraph(orderId).map(OrderJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Order> findByOrderNumber(String orderNumber) {
        return springDataRepository.findByOrderNumber(orderNumber).map(OrderJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Order> findByIdempotencyKey(String idempotencyKey) {
        return springDataRepository.findByIdempotencyKeyWithGraph(idempotencyKey).map(OrderJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Order> findByBuyerId(String buyerId) {
        return springDataRepository.findByBuyerId(buyerId).stream().map(OrderJpaEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Order> findBySubOrderId(Long subOrderId) {
        return springDataRepository.findBySubOrderId(subOrderId).map(OrderJpaEntity::toDomain);
    }

    public Optional<String> findOrderIdBySubOrderId(Long subOrderId) {
        return springDataRepository.findOrderIdBySubOrderId(subOrderId).map(UUID::toString);
    }

    @Transactional(readOnly = true)
    public List<Order> findBySellerIdAndFulfillmentStatus(String sellerId, com.vnshop.orderservice.domain.FulfillmentStatus status) {
        return springDataRepository.findBySellerIdAndFulfillmentStatus(sellerId, status).stream().map(OrderJpaEntity::toDomain).toList();
    }

    @Transactional(readOnly = true)
    public List<Order> findBySellerIdAndFulfillmentStatusIn(
            String sellerId, List<com.vnshop.orderservice.domain.FulfillmentStatus> statuses) {
        return springDataRepository.findBySellerIdAndFulfillmentStatusIn(sellerId, statuses).stream()
                .map(OrderJpaEntity::toDomain)
                .toList();
    }

    public long countByDateBetween(LocalDate startDate, LocalDate endDate) {
        return springDataRepository.countByCreatedAtBetween(startInstant(startDate), endInstant(endDate));
    }

    public BigDecimal sumRevenueByDateBetween(LocalDate startDate, LocalDate endDate) {
        return springDataRepository.sumRevenueByCreatedAtBetween(startInstant(startDate), endInstant(endDate));
    }

    public long countDistinctBuyerId(LocalDate startDate, LocalDate endDate) {
        return springDataRepository.countDistinctBuyerIdByCreatedAtBetween(startInstant(startDate), endInstant(endDate));
    }

    public long countDistinctSellerId(LocalDate startDate, LocalDate endDate) {
        return springDataRepository.countDistinctSellerIdByCreatedAtBetween(startInstant(startDate), endInstant(endDate));
    }

    public List<RevenueByDate> revenueByDateBetween(LocalDate startDate, LocalDate endDate) {
        return springDataRepository.revenueByDateBetween(startInstant(startDate), endInstant(endDate));
    }

    public List<TopMetric> topProducts(int limit) {
        return springDataRepository.topProducts(PageRequest.of(0, limit));
    }

    public List<TopMetric> topSellers(int limit) {
        return springDataRepository.topSellers(PageRequest.of(0, limit));
    }

    public List<SellerRevenueByDate> sellerRevenueByDateBetween(String sellerId, LocalDate startDate, LocalDate endDate) {
        return springDataRepository.sellerRevenueByDateBetween(sellerId, startInstant(startDate), endInstant(endDate));
    }

    private static Instant startInstant(LocalDate date) {
        return date.atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private static Instant endInstant(LocalDate date) {
        return date.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC).minusNanos(1);
    }

    public record RevenueByDate(LocalDate date, BigDecimal revenue) {
    }

    public record TopMetric(String id, String name, BigDecimal value) {
        public TopMetric(String id, String name, Number value) {
            this(id, name, BigDecimal.valueOf(value.longValue()));
        }
    }

    public record SellerRevenueByDate(LocalDate date, BigDecimal revenue, long orderCount) {
        public SellerRevenueByDate(LocalDate date, Number revenue, Number orderCount) {
            this(date,
                    revenue == null ? BigDecimal.ZERO : new BigDecimal(revenue.toString()),
                    orderCount == null ? 0L : orderCount.longValue());
        }
    }
}
