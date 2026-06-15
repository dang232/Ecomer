package com.vnshop.productservice.infrastructure.storage;

import java.io.FilterInputStream;
import java.io.IOException;
import java.security.MessageDigest;

/**
 * FilterInputStream that updates a {@link MessageDigest} with every byte read.
 * Allows computing the SHA-256 of a stream in a single pass while it's being
 * uploaded (rather than hashing the file twice or buffering the whole thing).
 */
final class DigestComputingInputStream extends FilterInputStream {

    private final MessageDigest digest;

    DigestComputingInputStream(java.io.InputStream in, MessageDigest digest) {
        super(in);
        this.digest = digest;
    }

    @Override
    public int read() throws IOException {
        int b = super.read();
        if (b != -1) {
            digest.update((byte) b);
        }
        return b;
    }

    @Override
    public int read(byte[] b, int off, int len) throws IOException {
        int n = super.read(b, off, len);
        if (n > 0) {
            digest.update(b, off, n);
        }
        return n;
    }
}
