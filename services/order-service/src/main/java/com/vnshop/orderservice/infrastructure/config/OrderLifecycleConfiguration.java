package com.vnshop.orderservice.infrastructure.config;

import com.vnshop.orderservice.application.AcceptOrderUseCase;
import com.vnshop.orderservice.application.AdminRefundUseCase;
import com.vnshop.orderservice.application.ApproveReturnUseCase;
import com.vnshop.orderservice.application.CancelOrderUseCase;
import com.vnshop.orderservice.application.CompleteReturnUseCase;
import com.vnshop.orderservice.application.ConfirmDeliveryUseCase;
import com.vnshop.orderservice.application.DashboardCsvExporter;
import com.vnshop.orderservice.application.FindOrderByIdempotencyKeyUseCase;
import com.vnshop.orderservice.application.ListOpenDisputesUseCase;
import com.vnshop.orderservice.application.ListOrdersUseCase;
import com.vnshop.orderservice.application.ListPendingOrdersUseCase;
import com.vnshop.orderservice.application.ListReturnsUseCase;
import com.vnshop.orderservice.application.RejectOrderUseCase;
import com.vnshop.orderservice.application.RejectReturnUseCase;
import com.vnshop.orderservice.application.RequestReturnUseCase;
import com.vnshop.orderservice.application.ShipOrderUseCase;
import com.vnshop.orderservice.application.ViewOrderUseCase;
import com.vnshop.orderservice.domain.port.out.DisputeRepositoryPort;
import com.vnshop.orderservice.domain.port.out.FinancialReversalRepositoryPort;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.OrderSummaryQueryPort;
import com.vnshop.orderservice.domain.port.out.PaymentRequestPort;
import com.vnshop.orderservice.domain.port.out.RefundRequestPort;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import com.vnshop.orderservice.domain.port.out.SellerFinanceAdjustmentPublisherPort;
import com.vnshop.orderservice.domain.port.out.SettlementHoldPublisherPort;
import com.vnshop.orderservice.domain.port.out.SubOrderFinancialAllocationRepositoryPort;
import com.vnshop.orderservice.domain.port.out.UserDirectoryPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OrderLifecycleConfiguration {
    @Bean
    ListOpenDisputesUseCase listOpenDisputesUseCase(
            DisputeRepositoryPort disputeRepositoryPort,
            ReturnRepositoryPort returnRepositoryPort,
            OrderSummaryQueryPort orderSummaryQueryPort,
            UserDirectoryPort userDirectoryPort) {
        return new ListOpenDisputesUseCase(disputeRepositoryPort, returnRepositoryPort,
                orderSummaryQueryPort, userDirectoryPort);
    }

    @Bean
    ListOrdersUseCase listOrdersUseCase(OrderRepositoryPort orderRepositoryPort) {
        return new ListOrdersUseCase(orderRepositoryPort);
    }

    @Bean
    ListPendingOrdersUseCase listPendingOrdersUseCase(OrderRepositoryPort orderRepositoryPort) {
        return new ListPendingOrdersUseCase(orderRepositoryPort);
    }

    @Bean
    ListReturnsUseCase listReturnsUseCase(ReturnRepositoryPort returnRepositoryPort) {
        return new ListReturnsUseCase(returnRepositoryPort);
    }

    @Bean
    ViewOrderUseCase viewOrderUseCase(OrderRepositoryPort orderRepositoryPort) {
        return new ViewOrderUseCase(orderRepositoryPort);
    }

    @Bean
    FindOrderByIdempotencyKeyUseCase findOrderByIdempotencyKeyUseCase(OrderRepositoryPort orderRepositoryPort) {
        return new FindOrderByIdempotencyKeyUseCase(orderRepositoryPort);
    }

    @Bean
    CancelOrderUseCase cancelOrderUseCase(OrderRepositoryPort orders, InventoryReservationPort inventory,
            OrderEventPublisherPort events, com.vnshop.orderservice.application.coupon.CouponRedemptionService coupons) {
        return new CancelOrderUseCase(orders, inventory, events, coupons);
    }

    @Bean
    AcceptOrderUseCase acceptOrderUseCase(OrderRepositoryPort orders, OrderEventPublisherPort events) {
        return new AcceptOrderUseCase(orders, events);
    }

    @Bean
    ConfirmDeliveryUseCase confirmDeliveryUseCase(OrderRepositoryPort orders, OrderEventPublisherPort events,
            SubOrderFinancialAllocationRepositoryPort allocations,
            SellerFinanceAdjustmentPublisherPort publisher, SellerFinanceEventModeProperties mode) {
        return new ConfirmDeliveryUseCase(orders, events, allocations, publisher, mode.adjustments().enabled());
    }

    @Bean
    RejectOrderUseCase rejectOrderUseCase(OrderRepositoryPort orders, InventoryReservationPort inventory,
            OrderEventPublisherPort events) {
        return new RejectOrderUseCase(orders, inventory, events);
    }

    @Bean
    ShipOrderUseCase shipOrderUseCase(OrderRepositoryPort orders, OrderEventPublisherPort events) {
        return new ShipOrderUseCase(orders, events);
    }

    @Bean
    RequestReturnUseCase requestReturnUseCase(OrderRepositoryPort orders, ReturnRepositoryPort returns,
            SettlementHoldPublisherPort holds) {
        return new RequestReturnUseCase(orders, returns, holds);
    }

    @Bean
    ApproveReturnUseCase approveReturnUseCase(ReturnRepositoryPort returns, OrderRepositoryPort orders) {
        return new ApproveReturnUseCase(returns, orders);
    }

    @Bean
    RejectReturnUseCase rejectReturnUseCase(ReturnRepositoryPort returns, OrderRepositoryPort orders,
            SettlementHoldPublisherPort holds) {
        return new RejectReturnUseCase(returns, orders, holds);
    }

    @Bean
    CompleteReturnUseCase completeReturnUseCase(ReturnRepositoryPort returns, OrderRepositoryPort orders,
            RefundRequestPort refunds, SubOrderFinancialAllocationRepositoryPort allocations,
            SellerFinanceAdjustmentPublisherPort publisher, FinancialReversalRepositoryPort reversals) {
        return new CompleteReturnUseCase(returns, orders, refunds, allocations, publisher, reversals);
    }

    @Bean
    AdminRefundUseCase adminRefundUseCase(OrderRepositoryPort orders, ReturnRepositoryPort returns,
            ApproveReturnUseCase approve, CompleteReturnUseCase complete) {
        return new AdminRefundUseCase(orders, returns, approve, complete);
    }

    @Bean
    DashboardCsvExporter dashboardCsvExporter() {
        return new DashboardCsvExporter();
    }
}
