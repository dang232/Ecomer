package com.vnshop.userservice.application;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Lightweight input sanitization for user-supplied fields.
 * No external dependencies — keeps the application layer free of infrastructure concerns.
 */
final class InputSanitizer {

    private static final Pattern HTML_TAG = Pattern.compile("<[^>]*>");

    // RFC-1918 + loopback + link-local + unspecified
    private static final Pattern PRIVATE_IP = Pattern.compile(
            "^(10\\." +
            "|172\\.(1[6-9]|2[0-9]|3[01])\\." +
            "|192\\.168\\." +
            "|127\\." +
            "|169\\.254\\." +
            "|0\\.0\\.0\\.0" +
            "|::1$" +
            "|fc00:" +
            "|fd[0-9a-fA-F]{2}:)"
    );

    private static final Set<String> BLOCKED_HOSTNAMES = Set.of(
            "localhost", "metadata", "169.254.169.254"
    );

    private InputSanitizer() {}

    /**
     * Strips all HTML tags from the input string.
     * Returns null if input is null.
     */
    static String stripHtml(String input) {
        if (input == null) {
            return null;
        }
        return HTML_TAG.matcher(input).replaceAll("");
    }

    /**
     * Validates that an avatar URL is safe to persist.
     * Allows http:// and https:// only; blocks private/internal IP ranges
     * and known internal hostnames.
     *
     * @throws IllegalArgumentException if the URL is invalid or disallowed
     */
    static void validateAvatarUrl(String url) {
        if (url == null || url.isBlank()) {
            return; // null/blank is allowed — means no avatar
        }

        URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("avatarUrl is not a valid URL: " + url);
        }

        String scheme = uri.getScheme();
        if (scheme == null || (!scheme.equals("http") && !scheme.equals("https"))) {
            throw new IllegalArgumentException(
                    "avatarUrl must use http or https scheme, got: " + scheme);
        }

        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("avatarUrl has no host: " + url);
        }

        String lowerHost = host.toLowerCase();

        // Block private/loopback IP ranges first (catches e.g. 169.254.169.254)
        if (PRIVATE_IP.matcher(host).find()) {
            throw new IllegalArgumentException(
                    "avatarUrl references a private or internal IP address: " + host);
        }

        // Block known internal hostnames (no dot = single-label = Docker/internal host)
        if (!lowerHost.contains(".") || BLOCKED_HOSTNAMES.contains(lowerHost)) {
            throw new IllegalArgumentException(
                    "avatarUrl references a disallowed internal host: " + host);
        }
    }
}
