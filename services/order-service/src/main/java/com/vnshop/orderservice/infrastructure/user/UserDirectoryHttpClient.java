package com.vnshop.orderservice.infrastructure.user;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.service.annotation.HttpExchange;

import java.util.List;

@HttpExchange
public interface UserDirectoryHttpClient {
    @GetMapping("/users/public-profiles")
    String listBuyerProfiles(@RequestParam("ids") List<String> ids);

    @GetMapping("/sellers/public-profiles")
    String listSellerProfiles(@RequestParam("ids") List<String> ids);
}
