package com.vnshop.orderservice.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.vnshop.orderservice.infrastructure.web.pagination.AdminCursorCodec;
import java.time.Clock;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import java.nio.file.Files;
import java.nio.file.Path;

class AdminCursorConfigTest {
    @Test
    void missingBlankOrPlaceholderSecretFailsConfiguration() {
        UseCaseConfig config = new UseCaseConfig();
        assertThatThrownBy(() -> config.adminCursorCodec("", Duration.ofHours(1), Clock.systemUTC()))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> config.adminCursorCodec("dev-only-change-me", Duration.ofHours(1), Clock.systemUTC()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void explicitSecretCreatesCodec() {
        AdminCursorCodec codec = new UseCaseConfig().adminCursorCodec("test-secret", Duration.ofHours(1), Clock.systemUTC());
        org.assertj.core.api.Assertions.assertThat(codec).isNotNull();
    }

    @Test
    void applicationConfigurationDoesNotForgeASecret() throws Exception {
        String yaml = Files.readString(Path.of("src/main/resources/application.yml"));
        org.assertj.core.api.Assertions.assertThat(yaml).contains("secret: ${ADMIN_CURSOR_SECRET}")
                .doesNotContain("ADMIN_CURSOR_SECRET:dev-only-change-me");
    }
}
