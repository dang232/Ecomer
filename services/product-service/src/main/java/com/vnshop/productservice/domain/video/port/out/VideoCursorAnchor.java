package com.vnshop.productservice.domain.video.port.out;

import java.time.Instant;
import java.util.UUID;

public record VideoCursorAnchor(Instant createdAt, UUID videoId) {}
