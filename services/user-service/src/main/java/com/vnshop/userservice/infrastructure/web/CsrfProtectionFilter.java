package com.vnshop.userservice.infrastructure.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Double-submit cookie CSRF protection for cookie-authenticated endpoints.
 *
 * <p>For {@code POST /auth/refresh} and {@code POST /auth/logout} the browser
 * automatically sends the {@code vnshop_rt} httpOnly cookie, making those
 * endpoints vulnerable to cross-site request forgery. This filter enforces the
 * double-submit pattern:
 *
 * <ol>
 *   <li>At login, {@link AuthSessionController} writes a non-httpOnly
 *       {@code vnshop_csrf} cookie alongside the httpOnly refresh-token cookie.
 *       The SPA can read this cookie via {@code document.cookie}.</li>
 *   <li>On every subsequent state-changing auth request the SPA must echo the
 *       cookie value back in the {@code X-CSRF-Token} request header.</li>
 *   <li>This filter compares the header value to the cookie value. A
 *       cross-origin attacker cannot read the cookie (same-origin policy), so
 *       they cannot forge the header, even though the browser sends both
 *       cookies automatically.</li>
 * </ol>
 *
 * <p>The check is skipped for {@code POST /auth/login} — that endpoint is not
 * cookie-authenticated (credentials are supplied in the body) so it has no
 * CSRF surface.
 */
public class CsrfProtectionFilter extends OncePerRequestFilter {

    /** Cookie name — readable by JS (not httpOnly) so the SPA can echo it. */
    public static final String CSRF_COOKIE_NAME = "vnshop_csrf";
    /** Header the SPA must include on state-changing auth requests. */
    public static final String CSRF_HEADER_NAME = "X-CSRF-Token";
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Paths under {@code /auth} that require the CSRF token. Login is excluded
     * because it is not authenticated by a cookie.
     */
    private static final Set<String> PROTECTED_PATHS = Set.of(
            "/auth/refresh",
            "/auth/logout"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();

        if ("POST".equalsIgnoreCase(method) && PROTECTED_PATHS.contains(path)) {
            String cookieToken = readCsrfCookie(request);
            String headerToken = request.getHeader(CSRF_HEADER_NAME);

            if (cookieToken == null || cookieToken.isBlank()
                    || !cookieToken.equals(headerToken)) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/problem+json");
                String requestId = request.getHeader("X-Request-ID");
                if (requestId == null || requestId.isBlank()) requestId = java.util.UUID.randomUUID().toString();
                response.setHeader("X-Request-ID", requestId);
                java.util.Map<String, Object> problem = new java.util.LinkedHashMap<>();
                problem.put("type", "https://api.vnshop.com/problems/csrf-invalid");
                problem.put("title", "Forbidden");
                problem.put("status", 403);
                problem.put("detail", "CSRF token missing or invalid");
                problem.put("instance", request.getRequestURI());
                problem.put("code", "CSRF_INVALID");
                problem.put("requestId", requestId);
                problem.put("traceId", requestId);
                problem.put("retryable", false);
                problem.put("fields", java.util.Map.of());
                problem.put("errorCode", "CSRF_INVALID");
                response.getWriter().write(objectMapper.writeValueAsString(problem));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private static String readCsrfCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) {
            if (CSRF_COOKIE_NAME.equals(cookie.getName())) {
                String value = cookie.getValue();
                return (value == null || value.isBlank()) ? null : value;
            }
        }
        return null;
    }
}
