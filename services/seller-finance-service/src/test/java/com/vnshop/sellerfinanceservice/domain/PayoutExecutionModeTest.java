package com.vnshop.sellerfinanceservice.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class PayoutExecutionModeTest {

    @Test
    void parsesSupportedModesWithoutAFailOpenFallback() {
        assertThat(PayoutExecutionMode.parse("disabled")).isEqualTo(PayoutExecutionMode.DISABLED);
        assertThat(PayoutExecutionMode.parse("MANUAL_RECORDED")).isEqualTo(PayoutExecutionMode.MANUAL_RECORDED);
        assertThat(PayoutExecutionMode.parse(" provider ")).isEqualTo(PayoutExecutionMode.PROVIDER);
    }

    @Test
    void rejectsMissingAndUnknownModes() {
        assertThatThrownBy(() -> PayoutExecutionMode.parse(" "))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PayoutExecutionMode.parse("AUTO"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("DISABLED");
    }
}
