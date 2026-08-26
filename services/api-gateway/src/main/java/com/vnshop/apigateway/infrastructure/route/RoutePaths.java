package com.vnshop.apigateway.infrastructure.route;

import java.util.Arrays;

final class RoutePaths {
    private RoutePaths() {}

    static String[] versioned(String... legacyPaths) {
        return Arrays.stream(legacyPaths)
                .flatMap(path -> java.util.stream.Stream.of(path, "/api/v1" + path))
                .toArray(String[]::new);
    }
}
