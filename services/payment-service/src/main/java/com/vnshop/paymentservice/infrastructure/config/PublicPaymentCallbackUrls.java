package com.vnshop.paymentservice.infrastructure.config;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

final class PublicPaymentCallbackUrls {

    private PublicPaymentCallbackUrls() {
    }

    static List<String> validate(
            String provider,
            String publicApiUrl,
            String frontendUrl,
            String returnUrl,
            String ipnUrl) {
        List<String> errors = new ArrayList<>();
        URI publicApi = publicHttpsOrigin(publicApiUrl, "VNSHOP_PUBLIC_API_URL", errors);
        URI frontend = publicHttpsOrigin(frontendUrl, "VNSHOP_FRONTEND_URL", errors);
        URI browserReturn = publicHttpsOrigin(returnUrl, provider + " return URL", errors);
        URI ipn = publicHttpsOrigin(ipnUrl, provider + " IPN URL", errors);

        if (publicApi != null && ipn != null && !sameOrigin(publicApi, ipn)) {
            errors.add(provider + " IPN URL must use the VNSHOP_PUBLIC_API_URL origin");
        }
        if (frontend != null && browserReturn != null && !sameOrigin(frontend, browserReturn)) {
            errors.add(provider + " return URL must use the VNSHOP_FRONTEND_URL origin");
        }
        return errors;
    }

    private static URI publicHttpsOrigin(String value, String label, List<String> errors) {
        if (value == null || value.isBlank()) {
            errors.add(label + " must be a public HTTPS URL when a redirect provider is enabled");
            return null;
        }
        try {
            URI uri = URI.create(value.trim());
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || host.isBlank() || isReservedHost(host)) {
                errors.add(label + " must be a public HTTPS URL when a redirect provider is enabled");
                return null;
            }
            return uri;
        } catch (IllegalArgumentException ignored) {
            errors.add(label + " must be a public HTTPS URL when a redirect provider is enabled");
            return null;
        }
    }

    private static boolean sameOrigin(URI first, URI second) {
        return first.getScheme().equalsIgnoreCase(second.getScheme())
                && first.getHost().equalsIgnoreCase(second.getHost())
                && effectivePort(first) == effectivePort(second);
    }

    private static int effectivePort(URI uri) {
        return uri.getPort() == -1 ? 443 : uri.getPort();
    }

    private static boolean isReservedHost(String rawHost) {
        String host = rawHost.toLowerCase(Locale.ROOT);
        if (host.equals("localhost") || host.endsWith(".localhost") || host.endsWith(".local")
                || host.endsWith(".invalid") || host.endsWith(".example")) {
            return true;
        }
        if (host.contains(":")) {
            return host.equals("::1") || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8")
                    || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb");
        }
        String[] octets = host.split("\\.");
        if (octets.length != 4) {
            return false;
        }
        try {
            int first = Integer.parseInt(octets[0]);
            int second = Integer.parseInt(octets[1]);
            return first == 0 || first == 10 || first == 127 || (first == 169 && second == 254)
                    || (first == 172 && second >= 16 && second <= 31) || (first == 192 && second == 168);
        } catch (NumberFormatException ignored) {
            return true;
        }
    }
}
