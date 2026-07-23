package com.vnshop.userservice.infrastructure.config;

import com.vnshop.userservice.infrastructure.web.CsrfProtectionFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.core.annotation.Order;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    private static final Set<String> CSRF_PROTECTED_PATHS = Set.of(
            "/auth/refresh", "/auth/logout");

    @Bean
    @Order(1)
    SecurityFilterChain authSecurityFilterChain(HttpSecurity http) throws Exception {
        // Keep the cookie session boundary separate from bearer-token resource
        // authorization. Refresh and logout authenticate with the httpOnly
        // cookie, so they must be reachable before JWT authorization runs.
        return http
                .securityMatcher("/auth/**")
                // CsrfProtectionFilter is the single double-submit policy for
                // these endpoints. The framework CsrfFilter would evaluate the
                // anonymous request first and turn a valid cookie refresh into
                // a 401 through the anonymous authentication entry point.
                .csrf(csrf -> csrf.disable())
                .addFilterBefore(new CsrfProtectionFilter(), UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .build();
    }

    @Bean
    @Order(2)
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfTokenRepository())
                        .requireCsrfProtectionMatcher(csrfRequestMatcher()))
                .addFilterBefore(new CsrfProtectionFilter(), UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api-docs", "/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/actuator/**").permitAll()
                        // These endpoints are the public cookie-auth boundary. Keep the
                        // explicit method matchers alongside the namespace matcher so
                        // refresh/logout never fall through to JWT authorization.
                        .requestMatchers(HttpMethod.POST, "/auth/login", "/auth/refresh", "/auth/logout")
                        .permitAll()
                        .requestMatchers("/auth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/sellers", "/sellers/{id}", "/sellers/public-profiles").permitAll()
                        .requestMatchers(HttpMethod.GET, "/users/public-profiles").permitAll()
                        .requestMatchers("/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())))
                .build();
    }

    private CookieCsrfTokenRepository csrfTokenRepository() {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookieName(CsrfProtectionFilter.CSRF_COOKIE_NAME);
        repository.setHeaderName(CsrfProtectionFilter.CSRF_HEADER_NAME);
        repository.setCookiePath("/");
        return repository;
    }

    private RequestMatcher csrfRequestMatcher() {
        return request -> "POST".equalsIgnoreCase(request.getMethod())
                && CSRF_PROTECTED_PATHS.contains(request.getRequestURI());
    }

    @Bean
    JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(keycloakRoleConverter());
        return converter;
    }

    private Converter<Jwt, Collection<GrantedAuthority>> keycloakRoleConverter() {
        return jwt -> {
            Collection<GrantedAuthority> realmRoles = extractRealmRoles(jwt);
            Collection<GrantedAuthority> scopeAuthorities = extractScopes(jwt);
            return Stream.concat(realmRoles.stream(), scopeAuthorities.stream())
                    .collect(Collectors.toSet());
        };
    }

    private Collection<GrantedAuthority> extractRealmRoles(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
        if (realmAccess == null || !(realmAccess.get("roles") instanceof Collection<?> roles)) {
            return List.of();
        }
        return roles.stream()
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .map(role -> role.startsWith("ROLE_") ? role.toUpperCase() : ("ROLE_" + role).toUpperCase())
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toSet());
    }

    private Collection<GrantedAuthority> extractScopes(Jwt jwt) {
        String scope = jwt.getClaimAsString("scope");
        if (scope == null || scope.isBlank()) {
            return List.of();
        }
        return Stream.of(scope.split(" "))
                .filter(s -> !s.isBlank())
                .map(s -> new SimpleGrantedAuthority("SCOPE_" + s))
                .collect(Collectors.toSet());
    }
}
