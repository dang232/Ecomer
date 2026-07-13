package com.vnshop.orderservice.infrastructure.config;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.InvoicePdfRendererPort;
import com.vnshop.orderservice.domain.port.out.PaymentRequestPort;
import com.vnshop.orderservice.domain.port.out.ShippingRequestPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.vnshop.orderservice.infrastructure.storage.DeterministicInvoicePdfRenderer;

import java.util.List;

@Configuration
public class PersistenceConfig {
    private static final Logger LOGGER = LoggerFactory.getLogger(PersistenceConfig.class);

    @Bean
    InventoryReservationPort inventoryReservationPort() {
        return new InventoryReservationPort() {
            @Override
            public void reserve(String orderId, List<OrderItem> items) {
                LOGGER.info("Stub inventory reservation succeeded for order {} with {} items", orderId, items.size());
            }

            @Override
            public void release(String orderId) {
                LOGGER.info("Stub inventory release succeeded for order {}", orderId);
            }
        };
    }

    @Bean
    PaymentRequestPort paymentRequestPort() {
        return new PaymentRequestPort() {
            @Override
            public void requestPayment(String orderId, String buyerId, String paymentMethod, Money amount) {
                LOGGER.info("Stub payment request pending for order {} method {} amount {} {}", orderId, paymentMethod, amount.amount(), amount.currency());
            }
        };
    }

    @Bean
    InvoicePdfRendererPort invoicePdfRendererPort() {
        return new DeterministicInvoicePdfRenderer();
    }

    @Bean
    ShippingRequestPort shippingRequestPort() {
        return new ShippingRequestPort() {
            @Override
            public void requestShipping(String orderId, SubOrder subOrder, Address shippingAddress) {
                LOGGER.info("Stub shipping request pending for order {} seller {} city {}", orderId, subOrder.sellerId(), shippingAddress.city());
            }
        };
    }
}
