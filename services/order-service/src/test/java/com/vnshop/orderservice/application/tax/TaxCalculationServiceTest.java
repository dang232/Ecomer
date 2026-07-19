package com.vnshop.orderservice.application.tax;

import com.vnshop.orderservice.domain.catalog.CatalogProduct;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.OrderItem;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class TaxCalculationServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 6, 7);

    private static OrderItem item(long unitPrice, int qty) {
        return new OrderItem(
                "prod-1", "sku-1", "seller-1", "Product",
                qty, new Money(BigDecimal.valueOf(unitPrice)), null);
    }

    @Test
    void standardRateRoundsToNearest1000() {
        // 100_000 × 0.10 = 10_000 — already on boundary
        TaxCalculationService svc = new TaxCalculationService(
                (code, date) -> Optional.of(new BigDecimal("0.10")));

        TaxResult result = svc.calculate(List.of(item(100_000, 1)), "STANDARD", TODAY);

        assertThat(result.totalTax()).isEqualByComparingTo(BigDecimal.valueOf(10_000));
        assertThat(result.appliedRate()).isEqualByComparingTo(new BigDecimal("0.10"));
    }

    @Test
    void reducedRateRoundsToNearest1000() {
        // 125_000 × 0.08 = 10_000 — exact
        TaxCalculationService svc = new TaxCalculationService(
                (code, date) -> Optional.of(new BigDecimal("0.08")));

        TaxResult result = svc.calculate(List.of(item(125_000, 1)), "REDUCED", TODAY);

        assertThat(result.totalTax()).isEqualByComparingTo(BigDecimal.valueOf(10_000));
    }

    @Test
    void vndRoundingAppliedWhenResultIsNotMultipleOf1000() {
        // 99_000 × 0.10 = 9_900 → rounds to 10_000
        TaxCalculationService svc = new TaxCalculationService(
                (code, date) -> Optional.of(new BigDecimal("0.10")));

        TaxResult result = svc.calculate(List.of(item(99_000, 1)), "STANDARD", TODAY);

        assertThat(result.totalTax()).isEqualByComparingTo(BigDecimal.valueOf(10_000));
    }

    @Test
    void fallsBackToDefaultRateWhenCategoryNotFound() {
        // No rate configured → default 10%
        // 50_000 × 0.10 = 5_000
        TaxCalculationService svc = new TaxCalculationService(
                (code, date) -> Optional.empty());

        TaxResult result = svc.calculate(List.of(item(50_000, 1)), "UNKNOWN", TODAY);

        assertThat(result.totalTax()).isEqualByComparingTo(BigDecimal.valueOf(5_000));
        assertThat(result.appliedRate()).isEqualByComparingTo(new BigDecimal("0.10"));
    }

    @Test
    void multipleItemsTaxSummed() {
        // item1: 100_000 × 0.10 = 10_000; item2: 200_000 × 0.10 = 20_000 → total 30_000
        TaxCalculationService svc = new TaxCalculationService(
                (code, date) -> Optional.of(new BigDecimal("0.10")));
        List<OrderItem> items = List.of(item(100_000, 1), item(200_000, 1));

        TaxResult result = svc.calculate(items, "STANDARD", TODAY);

        assertThat(result.totalTax()).isEqualByComparingTo(BigDecimal.valueOf(30_000));
        assertThat(result.lineItems()).hasSize(2);
    }

    @Test
    void emptyItemsReturnsZeroTax() {
        TaxCalculationService svc = new TaxCalculationService(
                (code, date) -> Optional.of(new BigDecimal("0.10")));

        TaxResult result = svc.calculate(List.of());

        assertThat(result.totalTax()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.lineItems()).isEmpty();
    }

    @Test
    void roundTo1000HelperRoundsCorrectly() {
        assertThat(TaxCalculationService.roundTo1000(new BigDecimal("9900"))).isEqualTo(10_000L);
        assertThat(TaxCalculationService.roundTo1000(new BigDecimal("9400"))).isEqualTo(9_000L);
        assertThat(TaxCalculationService.roundTo1000(new BigDecimal("9500"))).isEqualTo(10_000L);
        assertThat(TaxCalculationService.roundTo1000(new BigDecimal("10000"))).isEqualTo(10_000L);
    }
}
