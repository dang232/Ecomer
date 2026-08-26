package com.vnshop.orderservice.infrastructure.config;

import com.vnshop.orderservice.application.AcceptOrderUseCase;
import com.vnshop.orderservice.application.AdminOrderUseCase;
import com.vnshop.orderservice.application.AdminRefundUseCase;
import com.vnshop.orderservice.application.DashboardCsvExporter;
import com.vnshop.orderservice.application.ConfirmDeliveryUseCase;
import com.vnshop.orderservice.application.ApproveReturnUseCase;
import com.vnshop.orderservice.application.CalculateCheckoutUseCase;
import com.vnshop.orderservice.application.CancelOrderUseCase;
import com.vnshop.orderservice.application.CheckoutOrderUseCase;
import com.vnshop.orderservice.application.CompleteReturnUseCase;
import com.vnshop.orderservice.application.CreateOrderUseCase;
import com.vnshop.orderservice.application.OrderCreationPersistenceService;
import com.vnshop.orderservice.application.FindOrderByIdempotencyKeyUseCase;
import com.vnshop.orderservice.application.finance.AllocateOrderFinancialsUseCase;
import com.vnshop.orderservice.application.DisputeQueryUseCase;
import com.vnshop.orderservice.application.DisputeUseCase;
import com.vnshop.orderservice.application.GetDashboardUseCase;
import com.vnshop.orderservice.application.InvoiceUseCase;
import com.vnshop.orderservice.application.ListOpenDisputesUseCase;
import com.vnshop.orderservice.application.ListOrdersUseCase;
import com.vnshop.orderservice.application.ListPendingOrdersUseCase;
import com.vnshop.orderservice.application.ListReturnsUseCase;
import com.vnshop.orderservice.application.OrderQueryUseCase;
import com.vnshop.orderservice.application.RejectOrderUseCase;
import com.vnshop.orderservice.application.RejectReturnUseCase;
import com.vnshop.orderservice.application.RequestReturnUseCase;
import com.vnshop.orderservice.application.SellerOrderQueryUseCase;
import com.vnshop.orderservice.application.ShipOrderUseCase;
import com.vnshop.orderservice.application.ViewOrderUseCase;
import com.vnshop.orderservice.domain.port.out.OrderSummaryQueryPort;
import com.vnshop.orderservice.domain.port.out.UserDirectoryPort;
import com.vnshop.orderservice.domain.port.out.CommissionTierLookupPort;
import com.vnshop.orderservice.domain.port.out.CartRepositoryPort;
import com.vnshop.orderservice.domain.port.out.DashboardAnalyticsPort;
import com.vnshop.orderservice.domain.port.out.DisputeRepositoryPort;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.InvoicePdfRendererPort;
import com.vnshop.orderservice.domain.port.out.InvoiceRepositoryPort;
import com.vnshop.orderservice.domain.port.out.InvoiceStoragePort;
import com.vnshop.orderservice.domain.port.out.MetricsPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.PaymentRequestPort;
import com.vnshop.orderservice.domain.port.out.ProductCatalogPort;
import com.vnshop.orderservice.domain.port.out.RefundRequestPort;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import com.vnshop.orderservice.domain.port.out.ShippingRequestPort;
import com.vnshop.orderservice.application.saga.SagaOrchestrator;
import com.vnshop.orderservice.application.tax.TaxCalculationService;
import com.vnshop.orderservice.domain.port.out.TaxRateLookupPort;
import com.vnshop.orderservice.domain.port.out.SubOrderFinancialAllocationRepositoryPort;
import com.vnshop.orderservice.domain.port.out.SellerFinanceAdjustmentPublisherPort;
import com.vnshop.orderservice.domain.port.out.FinancialReversalRepositoryPort;
import com.vnshop.orderservice.domain.port.out.SettlementHoldPublisherPort;
import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import com.vnshop.orderservice.infrastructure.web.pagination.AdminCursorCodec;
import com.vnshop.orderservice.application.coupon.CouponManagementService;
import com.vnshop.orderservice.application.coupon.CouponRedemptionService;
import com.vnshop.orderservice.domain.coupon.CouponRepository;
import com.vnshop.orderservice.domain.coupon.CouponUsageRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Qualifier;
import io.github.resilience4j.bulkhead.Bulkhead;

@Configuration
public class UseCaseConfig {
    @Bean
    AdminCursorCodec adminCursorCodec(
            @Value("${vnshop.admin-cursor.secret}") String secret,
            @Value("${vnshop.admin-cursor.ttl:PT1H}") Duration ttl,
            Clock clock) {
        if (secret == null || secret.isBlank() || secret.equals("dev-only-change-me")) {
            throw new IllegalStateException("ADMIN_CURSOR_SECRET must be configured with a non-placeholder value");
        }
        return new AdminCursorCodec(secret, ttl, clock);
    }
    @Bean
    AdminOrderUseCase adminOrderUseCase(
            OrderRepositoryPort orderRepositoryPort,
            OrderSummaryQueryPort orderSummaryQueryPort,
            InventoryReservationPort inventoryReservationPort,
            OrderEventPublisherPort orderEventPublisherPort,
            CouponRedemptionService couponRedemptionService,
            UserDirectoryPort userDirectoryPort
    ) {
        return new AdminOrderUseCase(orderRepositoryPort, orderSummaryQueryPort, inventoryReservationPort,
                orderEventPublisherPort, couponRedemptionService, userDirectoryPort);
    }

    @Bean
    TaxCalculationService taxCalculationService(TaxRateLookupPort taxRateLookupPort) {
        return new TaxCalculationService(taxRateLookupPort);
    }

    @Bean
    AllocateOrderFinancialsUseCase allocateOrderFinancialsUseCase(
            SubOrderFinancialAllocationRepositoryPort allocationRepositoryPort) {
        return new AllocateOrderFinancialsUseCase(allocationRepositoryPort);
    }

    @Bean
    OrderCreationPersistenceService orderCreationPersistenceService(
            OrderRepositoryPort orderRepositoryPort,
            OrderEventPublisherPort orderEventPublisherPort,
            SagaOrchestrator sagaOrchestrator,
            AllocateOrderFinancialsUseCase allocateOrderFinancialsUseCase) {
        return new OrderCreationPersistenceService(orderRepositoryPort, orderEventPublisherPort,
                sagaOrchestrator, allocateOrderFinancialsUseCase);
    }

    @Bean
    CreateOrderUseCase createOrderUseCase(
            OrderRepositoryPort orderRepositoryPort,
            InventoryReservationPort inventoryReservationPort,
            PaymentRequestPort paymentRequestPort,
            ShippingRequestPort shippingRequestPort,
            OrderEventPublisherPort orderEventPublisherPort,
            CommissionTierLookupPort commissionTierLookupPort,
            CartRepositoryPort cartRepositoryPort,
            MetricsPort metricsPort,
            SagaOrchestrator sagaOrchestrator,
            TaxCalculationService taxCalculationService,
            CouponRedemptionService couponRedemptionService,
            AllocateOrderFinancialsUseCase allocateOrderFinancialsUseCase,
             OrderCreationPersistenceService orderCreationPersistenceService,
             @Qualifier("inventoryOrderBulkhead") Bulkhead inventoryOrderBulkhead,
             @Qualifier("paymentOrderBulkhead") Bulkhead paymentOrderBulkhead,
             @Qualifier("shippingOrderBulkhead") Bulkhead shippingOrderBulkhead
    ) {
        return new CreateOrderUseCase(orderRepositoryPort, inventoryReservationPort, paymentRequestPort,
                shippingRequestPort, orderEventPublisherPort, commissionTierLookupPort, cartRepositoryPort,
                metricsPort, sagaOrchestrator, taxCalculationService, couponRedemptionService,
                allocateOrderFinancialsUseCase, orderCreationPersistenceService, inventoryOrderBulkhead,
                paymentOrderBulkhead, shippingOrderBulkhead);
    }

    @Bean
    CouponRedemptionService couponRedemptionService(
            CouponRepository couponRepository,
            CouponUsageRepository couponUsageRepository,
            Clock clock) {
        return new CouponRedemptionService(couponRepository, couponUsageRepository, clock);
    }

    @Bean
    CouponManagementService couponManagementService(CouponRepository couponRepository, Clock clock) {
        return new CouponManagementService(couponRepository, clock);
    }

    @Bean
    CheckoutOrderUseCase checkoutOrderUseCase(
            ProductCatalogPort productCatalogPort,
            CreateOrderUseCase createOrderUseCase
    ) {
        return new CheckoutOrderUseCase(productCatalogPort, createOrderUseCase);
    }

    @Bean
    OrderQueryUseCase orderQueryUseCase(OrderRepositoryPort orderRepositoryPort) {
        return new OrderQueryUseCase(orderRepositoryPort);
    }

    @Bean
    SellerOrderQueryUseCase sellerOrderQueryUseCase(OrderRepositoryPort orderRepositoryPort) {
        return new SellerOrderQueryUseCase(orderRepositoryPort);
    }

    @Bean
    DisputeQueryUseCase disputeQueryUseCase(DisputeRepositoryPort disputeRepositoryPort) {
        return new DisputeQueryUseCase(disputeRepositoryPort);
    }

    @Bean
    GetDashboardUseCase getDashboardUseCase(
            DashboardAnalyticsPort analytics,
            UserDirectoryPort userDirectoryPort,
            Clock clock) {
        return new GetDashboardUseCase(analytics, userDirectoryPort, clock);
    }

    @Bean
    com.vnshop.orderservice.application.GetSellerRevenueUseCase getSellerRevenueUseCase(DashboardAnalyticsPort analytics) {
        return new com.vnshop.orderservice.application.GetSellerRevenueUseCase(analytics);
    }

    @Bean
    CalculateCheckoutUseCase calculateCheckoutUseCase(
            CartRepositoryPort cartRepositoryPort,
            ProductCatalogPort productCatalogPort,
            com.vnshop.orderservice.domain.port.out.CouponValidationPort couponValidationPort,
            TaxCalculationService taxCalculationService) {
        return new CalculateCheckoutUseCase(
                cartRepositoryPort, productCatalogPort, couponValidationPort, taxCalculationService);
    }

}
