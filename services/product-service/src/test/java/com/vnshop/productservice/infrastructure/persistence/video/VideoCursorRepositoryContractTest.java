package com.vnshop.productservice.infrastructure.persistence.video;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

class VideoCursorRepositoryContractTest {
    @Test
    void cursorQueryUsesAscendingKeysetWithoutCountOrOffset() throws NoSuchMethodException {
        Method method = VideoJpaSpringDataRepository.class.getMethod("findCursorAfter", String.class,
                java.time.Instant.class, java.util.UUID.class, org.springframework.data.domain.Pageable.class);
        String query = method.getAnnotation(Query.class).value();
        assertThat(query).contains("v.created_at > :anchorCreatedAt")
                .contains("v.video_id > :anchorVideoId")
                .contains("ORDER BY v.created_at ASC, v.video_id ASC")
                .doesNotContain("COUNT(").doesNotContain("OFFSET");
    }
}
