package com.vnshop.orderservice.infrastructure.idempotency;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

@Configuration
public class IdempotencyConfig implements WebMvcConfigurer {
    private final IdempotencyFilter idempotencyFilter;

    public IdempotencyConfig(IdempotencyFilter idempotencyFilter) {
        this.idempotencyFilter = idempotencyFilter;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(idempotencyFilter)
                .addPathPatterns("/orders/**", "/checkout/**");
    }

    @Bean
    FilterRegistrationBean<OncePerRequestFilter> idempotencyRequestCachingFilter() {
        OncePerRequestFilter filter = new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                             FilterChain filterChain) throws ServletException, IOException {
                filterChain.doFilter(new CachedBodyRequestWrapper(request), response);
            }
        };
        FilterRegistrationBean<OncePerRequestFilter> registration = new FilterRegistrationBean<>(filter);
        registration.addUrlPatterns("/*");
        registration.setOrder(Integer.MIN_VALUE);
        return registration;
    }

    private static final class CachedBodyRequestWrapper extends ContentCachingRequestWrapper {
        private final byte[] body;

        private CachedBodyRequestWrapper(HttpServletRequest request) throws IOException {
            super(request, 10 * 1024 * 1024);
            body = request.getInputStream().readAllBytes();
        }

        @Override
        public jakarta.servlet.ServletInputStream getInputStream() {
            java.io.ByteArrayInputStream input = new java.io.ByteArrayInputStream(body);
            return new jakarta.servlet.ServletInputStream() {
                @Override public int read() { return input.read(); }
                @Override public boolean isFinished() { return input.available() == 0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(jakarta.servlet.ReadListener listener) { }
            };
        }

        @Override
        public java.io.BufferedReader getReader() throws IOException {
            return new java.io.BufferedReader(new java.io.InputStreamReader(getInputStream(), getCharacterEncoding()));
        }
    }
}
