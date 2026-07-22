package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.DashboardReport;
import com.vnshop.orderservice.domain.RevenueTimeSeries;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class DashboardCsvExporter {
    private static final String UNKNOWN_SHOP = "Unknown shop";

    public byte[] export(DashboardReport report) {
        StringBuilder csv = new StringBuilder();
        row(csv, "section", "date", "id", "name", "value", "unit", "currency");
        appendSummary(csv, report);
        for (RevenueTimeSeries.Point point : report.revenue().points()) {
            row(csv, "revenue", point.date().toString(), "", "paidGmv",
                    point.paidGmv().toPlainString(), "amount", "VND");
            row(csv, "revenue", point.date().toString(), "", "refundedAmount",
                    point.refundedAmount().toPlainString(), "amount", "VND");
            row(csv, "revenue", point.date().toString(), "", "realizedRevenue",
                    point.realizedRevenue().toPlainString(), "amount", "VND");
        }
        report.topProducts().forEach(product -> row(csv, "top-product", "", product.productId(),
                product.name(), Long.toString(product.unitsSold()), "count", ""));
        report.topSellers().forEach(seller -> row(csv, "top-seller", "", seller.sellerId(),
                seller.shopName() == null || seller.shopName().isBlank() ? UNKNOWN_SHOP : seller.shopName(),
                seller.paidGmv().toPlainString(), "amount", "VND"));
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static void appendSummary(StringBuilder csv, DashboardReport report) {
        var summary = report.summary();
        row(csv, "summary", "", "", "paidGmv", summary.paidGmv().toPlainString(), "amount", "VND");
        row(csv, "summary", "", "", "refundedAmount", summary.refundedAmount().toPlainString(), "amount", "VND");
        row(csv, "summary", "", "", "realizedRevenue", summary.realizedRevenue().toPlainString(), "amount", "VND");
        row(csv, "summary", "", "", "totalOrders", Long.toString(summary.totalOrders()), "count", "");
        row(csv, "summary", "", "", "activeBuyers", Long.toString(summary.activeBuyers()), "count", "");
        row(csv, "summary", "", "", "activeSellers", Long.toString(summary.activeSellers()), "count", "");
        row(csv, "summary", "", "", "avgPaidOrderValue",
                summary.avgPaidOrderValue().toPlainString(), "amount", "VND");
    }

    private static void row(StringBuilder csv, String... values) {
        for (int i = 0; i < values.length; i++) {
            if (i > 0) csv.append(',');
            csv.append(escape(values[i]));
        }
        csv.append('\n');
    }

    private static String escape(String value) {
        String normalized = value == null ? "" : value;
        if (normalized.indexOf(',') < 0 && normalized.indexOf('"') < 0
                && normalized.indexOf('\n') < 0 && normalized.indexOf('\r') < 0) {
            return normalized;
        }
        return '"' + normalized.replace("\"", "\"\"") + '"';
    }
}
