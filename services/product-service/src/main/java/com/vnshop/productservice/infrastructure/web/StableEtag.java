package com.vnshop.productservice.infrastructure.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

final class StableEtag {
    private static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules();

    private StableEtag() {
    }

    static String of(Object businessPayload) {
        try {
            byte[] payload = MAPPER.writeValueAsString(businessPayload).getBytes(StandardCharsets.UTF_8);
            return "\"" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload)) + "\"";
        } catch (Exception exception) {
            throw new IllegalStateException("could not create stable ETag", exception);
        }
    }
}
