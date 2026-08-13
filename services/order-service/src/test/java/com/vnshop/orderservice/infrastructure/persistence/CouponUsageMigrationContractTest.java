package com.vnshop.orderservice.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class CouponUsageMigrationContractTest {
    @Test
    void dropsTheRedundantIndexAddedByV34() throws Exception {
        String migration = Files.readString(Path.of(
                "src/main/resources/db/migration/V35__drop_redundant_coupon_usage_index.sql"));

        assertThat(migration).contains("DROP INDEX IF EXISTS order_svc.idx_coupon_usages_consumed_coupon_user");
    }
}
