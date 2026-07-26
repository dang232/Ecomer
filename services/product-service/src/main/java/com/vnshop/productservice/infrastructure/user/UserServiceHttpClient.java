package com.vnshop.productservice.infrastructure.user;

import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;

import java.util.List;

/**
 * Declarative HTTP client for user-service's batch public-profile
 * endpoint. The response envelope mirrors {@code ApiResponse<T>} on
 * the user-service side; the adapter unwraps it into the typed
 * payload.
 */
@HttpExchange
public interface UserServiceHttpClient {
    @GetExchange("/users/public-profiles")
    String list(@RequestParam("ids") List<String> ids);
}
