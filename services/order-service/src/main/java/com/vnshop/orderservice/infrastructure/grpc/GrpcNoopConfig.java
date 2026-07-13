package com.vnshop.orderservice.infrastructure.grpc;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.PaymentRequestPort;
import com.vnshop.orderservice.domain.port.out.ShippingRequestPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Fallback no-op adapters for the three gRPC-backed ports.
 * Each bean activates only when the real gRPC adapter is absent
 * (i.e. {@code grpc.client.enabled=false} or the gRPC stubs were not created).
 * This lets the application context start for local development without
 * running inventory, payment, or shipping gRPC services.
 */
@Configuration
public class GrpcNoopConfig {

    @Bean
    @ConditionalOnMissingBean(InventoryReservationPort.class)
    InventoryReservationPort noopInventoryReservationPort() {
        return new InventoryReservationPort() {
            private static final Logger LOGGER = LoggerFactory.getLogger(InventoryReservationPort.class);

            @Override
            public void reserve(String orderId, List<OrderItem> items) {
                LOGGER.warn("noop inventory adapter — reserve skipped for order {} ({} items); gRPC service unavailable",
                        orderId, items.size());
            }

            @Override
            public void release(String orderId) {
                LOGGER.warn("noop inventory adapter — release skipped for order {}; gRPC service unavailable",
                        orderId);
            }
        };
    }

    @Bean
    @ConditionalOnMissingBean(PaymentRequestPort.class)
    PaymentRequestPort noopPaymentRequestPort() {
        return new PaymentRequestPort() {
            private static final Logger LOGGER = LoggerFactory.getLogger(PaymentRequestPort.class);

            @Override
            public void requestPayment(String orderId, String buyerId, String paymentMethod, Money amount) {
                LOGGER.warn("noop payment adapter — requestPayment skipped for order {} method={} amount={}; gRPC service unavailable",
                        orderId, paymentMethod, amount);
            }
        };
    }

    @Bean
    @ConditionalOnMissingBean(ShippingRequestPort.class)
    ShippingRequestPort noopShippingRequestPort() {
        return new ShippingRequestPort() {
            private static final Logger LOGGER = LoggerFactory.getLogger(ShippingRequestPort.class);

            @Override
            public void requestShipping(String orderId, SubOrder subOrder, Address shippingAddress) {
                LOGGER.warn("noop shipping adapter — requestShipping skipped for order {} seller={}; gRPC service unavailable",
                        orderId, subOrder.sellerId());
            }
        };
    }
}
