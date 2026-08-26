package com.vnshop.productservice.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class VariantRequestTest {
    @Test
    void mapsCompleteParcelMetadata() {
        VariantRequest request = new VariantRequest(
                "sku", "Default", new BigDecimal("100"), "VND", null, 1,
                new VariantRequest.ParcelRequest(1500, 30, 20, 10, 777000L));

        assertThat(request.toDomain().parcel()).isNotNull();
        assertThat(request.toDomain().parcel().weightGrams()).isEqualTo(1500);
        assertThat(request.toDomain().parcel().declaredValueMinor()).isEqualTo(777000);
    }

    @Test
    void rejectsPartialParcelMetadata() {
        VariantRequest request = new VariantRequest(
                "sku", "Default", new BigDecimal("100"), "VND", null, 1,
                new VariantRequest.ParcelRequest(1500, null, 20, 10));

        assertThatThrownBy(request::toDomain)
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void omittedDeclaredValueDefaultsToZeroWhenJsonBindsParcel() throws Exception {
        VariantRequest request = new ObjectMapper().readValue("""
                {
                  "sku": "sku",
                  "name": "Default",
                  "priceAmount": 100,
                  "priceCurrency": "VND",
                  "stockQuantity": 1,
                  "parcel": {
                    "weightGrams": 1500,
                    "lengthCm": 30,
                    "widthCm": 20,
                    "heightCm": 10
                  }
                }
                """, VariantRequest.class);

        assertThat(request.toDomain().parcel().declaredValueMinor()).isZero();
    }
}
