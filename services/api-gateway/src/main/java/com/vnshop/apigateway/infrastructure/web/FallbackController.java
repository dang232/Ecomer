package com.vnshop.apigateway.infrastructure.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class FallbackController {

    // ponytail: a non-2xx response must never carry ApiResponse.ok(...)
    // (success: true, message: "Success"). The FE's response interceptor treats
    // response.ok === false as an error and surfaces the envelope's `message`
    // verbatim to the user — so a "Success" message on a 503 status shows as
    // "Success" in the UI. Use the error envelope so the body and the status
    // agree.
    @RequestMapping("/fallback/{service}")
    ResponseEntity<ErrorResponse> fallback(@PathVariable String service) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(ErrorResponse.of("SERVICE_UNAVAILABLE", "Service temporarily unavailable", 503, java.util.List.of(), null));
    }
}
