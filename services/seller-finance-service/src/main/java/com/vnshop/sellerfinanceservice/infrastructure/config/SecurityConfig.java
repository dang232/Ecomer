package com.vnshop.sellerfinanceservice.infrastructure.config;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.util.matcher.RequestMatcher;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {
    private static final String REFRESH_TOKEN_COOKIE = "vnshop_rt";

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfTokenRepository())
                        .requireCsrfProtectionMatcher(cookieAuthenticatedRequestMatcher()))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api-docs", "/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())))
                .build();
    }

    private CookieCsrfTokenRepository csrfTokenRepository() {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookieName("vnshop_csrf");
        repository.setHeaderName("X-CSRF-Token");
        repository.setCookiePath("/");
        return repository;
    }

    private RequestMatcher cookieAuthenticatedRequestMatcher() {
        return request -> {
            if (List.of("GET", "HEAD", "OPTIONS", "TRACE").contains(request.getMethod())) {
                return false;
            }
            return request.getCookies() != null
                    && List.of(request.getCookies()).stream()
                    .anyMatch(cookie -> REFRESH_TOKEN_COOKIE.equals(cookie.getName()));
        };
    }

    private JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(new KeycloakRealmRoleConverter());
        return converter;
    }

    private static class KeycloakRealmRoleConverter implements Converter<Jwt, Collection<GrantedAuthority>> {
        @Override
        @SuppressWarnings("unchecked")
        public Collection<GrantedAuthority> convert(Jwt jwt) {
            Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
            if (realmAccess == null || realmAccess.get("roles") == null) {
                return Collections.emptyList();
            }
            List<String> roles = (List<String>) realmAccess.get("roles");
            Stream<GrantedAuthority> realmRoles = roles.stream()
                    .map(role -> new SimpleGrantedAuthority("ROLE_" + role));

            // Also include scopes if present
            List<String> scopes = jwt.getClaimAsStringList("scope");
            Stream<GrantedAuthority> scopeAuthorities = scopes != null
                    ? scopes.stream().map(s -> new SimpleGrantedAuthority("SCOPE_" + s))
                    : Stream.empty();

            return Stream.concat(realmRoles, scopeAuthorities).toList();
        }
    }
}
