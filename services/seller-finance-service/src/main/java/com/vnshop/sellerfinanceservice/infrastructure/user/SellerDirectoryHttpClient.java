package com.vnshop.sellerfinanceservice.infrastructure.user;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.service.annotation.HttpExchange;

@HttpExchange
public interface SellerDirectoryHttpClient {
    @GetMapping("/sellers/public-profiles")
    String list(@RequestParam("ids") List<String> ids);
}
