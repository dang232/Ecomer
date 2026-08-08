package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Dispute;
import com.vnshop.orderservice.domain.DisputeStatus;
import com.vnshop.orderservice.domain.port.out.DisputeRepositoryPort;
import com.vnshop.orderservice.domain.port.out.OrderSummaryQueryPort;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import com.vnshop.orderservice.domain.port.out.UserDirectoryPort;
import com.vnshop.orderservice.domain.projection.OrderSummaryProjection;

import java.util.Map;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import java.time.Instant;

public class ListOpenDisputesUseCase {

    private final DisputeRepositoryPort disputeRepositoryPort;
    private final ReturnRepositoryPort returnRepositoryPort;
    private final OrderSummaryQueryPort orderSummaryQueryPort;
    private final UserDirectoryPort userDirectoryPort;

    public ListOpenDisputesUseCase(
            DisputeRepositoryPort disputeRepositoryPort,
            ReturnRepositoryPort returnRepositoryPort,
            OrderSummaryQueryPort orderSummaryQueryPort,
            UserDirectoryPort userDirectoryPort) {
        this.disputeRepositoryPort = Objects.requireNonNull(disputeRepositoryPort, "disputeRepositoryPort is required");
        this.returnRepositoryPort = Objects.requireNonNull(returnRepositoryPort, "returnRepositoryPort is required");
        this.orderSummaryQueryPort = Objects.requireNonNull(orderSummaryQueryPort, "orderSummaryQueryPort is required");
        this.userDirectoryPort = Objects.requireNonNull(userDirectoryPort, "userDirectoryPort is required");
    }

    public List<Dispute> listOpen() {
        return listOpen(null);
    }

    public List<Dispute> listOpen(String query) {
        return disputeRepositoryPort.findByStatus(DisputeStatus.OPEN.name(), query);
    }

    public List<EnrichedDispute> listOpenEnriched(String query) {
        List<Dispute> disputes = listOpen(query);
        if (disputes.isEmpty()) {
            return List.of();
        }
        Map<UUID, com.vnshop.orderservice.domain.Return> returns = disputes.stream()
                .map(Dispute::returnId)
                .map(this::parseUuid)
                .flatMap(java.util.Optional::stream)
                .map(returnRepositoryPort::findById)
                .flatMap(java.util.Optional::stream)
                .collect(Collectors.toMap(com.vnshop.orderservice.domain.Return::returnId,
                        value -> value, (left, right) -> left));
        Map<String, OrderSummaryProjection> orders = returns.values().stream()
                .map(com.vnshop.orderservice.domain.Return::orderId)
                .distinct()
                .map(orderSummaryQueryPort::findByOrderId)
                .flatMap(java.util.Optional::stream)
                .collect(Collectors.toMap(OrderSummaryProjection::orderId, value -> value, (left, right) -> left));
        var buyerIds = returns.values().stream()
                .map(com.vnshop.orderservice.domain.Return::buyerId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        var sellerIds = orders.values().stream()
                .map(OrderSummaryProjection::sellerId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        UserDirectoryPort.DirectorySnapshot names = userDirectoryPort.lookup(buyerIds, sellerIds);
        return disputes.stream().map(dispute -> {
            var orderReturn = parseUuid(dispute.returnId()).map(returns::get).orElse(null);
            var order = orderReturn == null ? null : orders.get(orderReturn.orderId());
            return new EnrichedDispute(
                    dispute,
                    orderReturn == null ? null : orderReturn.orderId(),
                    order == null ? null : order.orderNumber(),
                    orderReturn == null ? null : orderReturn.buyerId(),
                    orderReturn == null ? null : names.buyerNames().get(orderReturn.buyerId()),
                    order == null ? null : order.sellerId(),
                    order == null ? null : names.sellerNames().get(order.sellerId()),
                    orderReturn == null ? null : orderReturn.requestedAt());
        }).toList();
    }

    public DisputeCursorResult listOpenEnrichedCursor(String query, Instant createdAtBefore,
            UUID disputeIdBefore, int limit) {
        List<com.vnshop.orderservice.domain.port.out.DisputeRepositoryPort.DisputeCursorItem> rows =
                disputeRepositoryPort.findCursor(DisputeStatus.OPEN.name(), query, createdAtBefore, disputeIdBefore, limit + 1);
        boolean hasMore = rows.size() > limit;
        List<com.vnshop.orderservice.domain.port.out.DisputeRepositoryPort.DisputeCursorItem> bounded = hasMore
                ? rows.subList(0, limit) : rows;
        List<EnrichedDispute> enriched = enrich(bounded.stream().map(
                com.vnshop.orderservice.domain.port.out.DisputeRepositoryPort.DisputeCursorItem::dispute).toList());
        var last = rows.isEmpty() ? null : rows.get(Math.min(limit, rows.size()) - 1);
        return new DisputeCursorResult(enriched, hasMore, last == null ? null : last.createdAt(),
                last == null ? null : last.dispute().disputeId());
    }

    private List<EnrichedDispute> enrich(List<Dispute> disputes) {
        if (disputes.isEmpty()) return List.of();
        Map<UUID, com.vnshop.orderservice.domain.Return> returns = disputes.stream().map(Dispute::returnId)
                .map(this::parseUuid).flatMap(java.util.Optional::stream).map(returnRepositoryPort::findById)
                .flatMap(java.util.Optional::stream).collect(Collectors.toMap(com.vnshop.orderservice.domain.Return::returnId,
                        value -> value, (left, right) -> left));
        Map<String, OrderSummaryProjection> orders = returns.values().stream().map(com.vnshop.orderservice.domain.Return::orderId)
                .distinct().map(orderSummaryQueryPort::findByOrderId).flatMap(java.util.Optional::stream)
                .collect(Collectors.toMap(OrderSummaryProjection::orderId, value -> value, (left, right) -> left));
        var buyerIds = returns.values().stream().map(com.vnshop.orderservice.domain.Return::buyerId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        var sellerIds = orders.values().stream().map(OrderSummaryProjection::sellerId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        UserDirectoryPort.DirectorySnapshot names = userDirectoryPort.lookup(buyerIds, sellerIds);
        return disputes.stream().map(dispute -> {
            var orderReturn = parseUuid(dispute.returnId()).map(returns::get).orElse(null);
            var order = orderReturn == null ? null : orders.get(orderReturn.orderId());
            return new EnrichedDispute(dispute, orderReturn == null ? null : orderReturn.orderId(), order == null ? null : order.orderNumber(),
                    orderReturn == null ? null : orderReturn.buyerId(), orderReturn == null ? null : names.buyerNames().get(orderReturn.buyerId()),
                    order == null ? null : order.sellerId(), order == null ? null : names.sellerNames().get(order.sellerId()),
                    orderReturn == null ? null : orderReturn.requestedAt());
        }).toList();
    }

    private java.util.Optional<UUID> parseUuid(String value) {
        try {
            return java.util.Optional.of(UUID.fromString(value));
        } catch (RuntimeException ex) {
            return java.util.Optional.empty();
        }
    }
}
