package com.vnshop.invoiceservice.infrastructure.config;

import java.util.Objects;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "invoice")
public record InvoiceProperties(
        String currency,
        String templateCode,
        String paymentMethod,
        String symbol,
        Seller seller) {

    public InvoiceProperties {
        currency = required(currency, "invoice.currency");
        templateCode = required(templateCode, "invoice.template-code");
        paymentMethod = required(paymentMethod, "invoice.payment-method");
        symbol = required(symbol, "invoice.symbol");
        seller = Objects.requireNonNull(seller, "invoice.seller must be configured");
    }

    public record Seller(String name, String taxCode, String address, String phone, String email) {
        public Seller {
            name = required(name, "invoice.seller.name");
            taxCode = required(taxCode, "invoice.seller.tax-code");
            address = required(address, "invoice.seller.address");
            email = required(email, "invoice.seller.email");
        }
    }

    private static String required(String value, String propertyName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(propertyName + " must be configured");
        }
        return value;
    }
}
