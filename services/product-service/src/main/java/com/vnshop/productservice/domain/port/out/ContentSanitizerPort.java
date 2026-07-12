package com.vnshop.productservice.domain.port.out;

/** Sanitizes untrusted user-authored content before it enters the domain. */
public interface ContentSanitizerPort {
    String sanitize(String untrusted);
}
