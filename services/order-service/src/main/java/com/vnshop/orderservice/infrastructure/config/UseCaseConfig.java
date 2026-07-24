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
import java.time.Clock;
import com.vnshop.orderservice.application.coupon.CouponManagementService;
import com.vnshop.orderservice.application.coupon.CouponRedemptionService;
import com.vnshop.orderservice.domain.coupon.CouponRepository;
import com.vnshop.orderservice.domain.coupon.CouponUsageRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;

@Configuration
public class UseCaseConfig {
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
            AllocateOrderFinancialsUseCase allocateOrderFinancialsUseCase
    ) {
        return new CreateOrderUseCase(orderRepositoryPort, inventoryReservationPort, paymentRequestPort,
                shippingRequestPort, orderEventPublisherPort, commissionTierLookupPort, cartRepositoryPort,
                metricsPort, sagaOrchestrator, taxCalculationService, couponRedemptionService,
                allocateOrderFinancialsUseCase);
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
            com.vnshop.orderservice.domain.port.out.CouponValidationPort couponValidationPort) {
        return new CalculateCheckoutUseCase(cartRepositoryPort, productCatalogPort, couponValidationPort);
    }

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
    CancelOrderUseCase cancelOrderUseCase(
            OrderRepositoryPort orderRepositoryPort,
            InventoryReservationPort inventoryReservationPort,
            OrderEventPublisherPort orderEventPublisherPort,
            CouponRedemptionService couponRedemptionService
    ) {
        return new CancelOrderUseCase(orderRepositoryPort, inventoryReservationPort,
                orderEventPublisherPort, couponRedemptionService);
    }

    @Bean
    AcceptOrderUseCase acceptOrderUseCase(OrderRepositoryPort orderRepositoryPort, OrderEventPublisherPort orderEventPublisherPort) {
        return new AcceptOrderUseCase(orderRepositoryPort, orderEventPublisherPort);
    }

    @Bean
    ConfirmDeliveryUseCase confirmDeliveryUseCase(
            OrderRepositoryPort orderRepositoryPort,
            OrderEventPublisherPort orderEventPublisherPort,
            SubOrderFinancialAllocationRepositoryPort allocationRepositoryPort,
            SellerFinanceAdjustmentPublisherPort sellerFinanceAdjustmentPublisherPort,
            @Value("${seller-finance.adjustments.enabled:false}") boolean sellerFinanceAdjustmentsEnabled) {
        return new ConfirmDeliveryUseCase(orderRepositoryPort, orderEventPublisherPort, allocationRepositoryPort,
                sellerFinanceAdjustmentPublisherPort, sellerFinanceAdjustmentsEnabled);
    }

    @Bean
    RejectOrderUseCase rejectOrderUseCase(
            OrderRepositoryPort orderRepositoryPort,
            InventoryReservationPort inventoryReservationPort,
            OrderEventPublisherPort orderEventPublisherPort
    ) {
        return new RejectOrderUseCase(orderRepositoryPort, inventoryReservationPort, orderEventPublisherPort);
    }

    @Bean
    ShipOrderUseCase shipOrderUseCase(OrderRepositoryPort orderRepositoryPort, OrderEventPublisherPort orderEventPublisherPort) {
        return new ShipOrderUseCase(orderRepositoryPort, orderEventPublisherPort);
    }

    @Bean
    RequestReturnUseCase requestReturnUseCase(OrderRepositoryPort orderRepositoryPort, ReturnRepositoryPort returnRepositoryPort) {
        return new RequestReturnUseCase(orderRepositoryPort, returnRepositoryPort);
    }

    @Bean
    ApproveReturnUseCase approveReturnUseCase(ReturnRepositoryPort returnRepositoryPort, OrderRepositoryPort orderRepositoryPort) {
        return new ApproveReturnUseCase(returnRepositoryPort, orderRepositoryPort);
    }

    @Bean
    RejectReturnUseCase rejectReturnUseCase(ReturnRepositoryPort returnRepositoryPort, OrderRepositoryPort orderRepositoryPort) {
        return new RejectReturnUseCase(returnRepositoryPort, orderRepositoryPort);
    }

    @Bean
    CompleteReturnUseCase completeReturnUseCase(
            ReturnRepositoryPort returnRepositoryPort,
            OrderRepositoryPort orderRepositoryPort,
            RefundRequestPort refundRequestPort
    ) {
        return new CompleteReturnUseCase(returnRepositoryPort, orderRepositoryPort, refundRequestPort);
    }

    @Bean
    AdminRefundUseCase adminRefundUseCase(
            OrderRepositoryPort orderRepositoryPort,
            ReturnRepositoryPort returnRepositoryPort,
            ApproveReturnUseCase approveReturnUseCase,
            CompleteReturnUseCase completeReturnUseCase) {
        return new AdminRefundUseCase(orderRepositoryPort, returnRepositoryPort,
                approveReturnUseCase, completeReturnUseCase);
    }

    @Bean
    DashboardCsvExporter dashboardCsvExporter() {
        return new DashboardCsvExporter();
    }

    @Bean
    DisputeUseCase disputeUseCase(ReturnRepositoryPort returnRepositoryPort, DisputeRepositoryPort disputeRepositoryPort) {
        return new DisputeUseCase(returnRepositoryPort, disputeRepositoryPort);
    }

    @Bean
    InvoiceUseCase invoiceUseCase(
            OrderRepositoryPort orderRepositoryPort,
            InvoiceRepositoryPort invoiceRepositoryPort,
            InvoiceStoragePort invoiceStoragePort,
            InvoicePdfRendererPort invoicePdfRendererPort,
            Clock clock
    ) {
        return new InvoiceUseCase(orderRepositoryPort, invoiceRepositoryPort, invoiceStoragePort, invoicePdfRendererPort, clock);
    }

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
