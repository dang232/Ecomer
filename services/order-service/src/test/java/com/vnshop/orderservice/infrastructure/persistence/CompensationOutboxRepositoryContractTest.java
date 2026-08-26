package com.vnshop.orderservice.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class CompensationOutboxRepositoryContractTest {

    @Test
    void pendingClaimUsesDueOrderingAndSkipLocked() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/vnshop/orderservice/infrastructure/outbox/CompensationOutboxSpringDataRepository.java"),
                StandardCharsets.UTF_8);

        assertThat(source)
                .contains("status = 'PENDING'")
                .contains("next_attempt_at <= :now")
                .contains("ORDER BY created_at ASC")
                .contains("FOR UPDATE SKIP LOCKED");
    }
}
