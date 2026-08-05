package com.vnshop.productservice.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.Cookie;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.web.util.matcher.RequestMatcher;

class SecurityConfigVideoUploadTest {

    @Test
    void tusUploadBoundaryDoesNotRequireCsrfWhenARefreshCookieIsPresent() throws Exception {
        RequestMatcher matcher = cookieAuthenticatedRequestMatcher();

        MockHttpServletRequest creation = request("POST", "/videos/upload");
        creation.setCookies(new Cookie("vnshop_rt", "refresh-token"));
        MockHttpServletRequest chunk = request("PATCH", "/videos/upload/00000000-0000-0000-0000-000000000001");
        chunk.setCookies(new Cookie("vnshop_rt", "refresh-token"));

        assertThat(matcher.matches(creation)).isFalse();
        assertThat(matcher.matches(chunk)).isFalse();
    }

    @Test
    void unrelatedStateChangingRequestsStillRequireCsrfWhenARefreshCookieIsPresent() throws Exception {
        RequestMatcher matcher = cookieAuthenticatedRequestMatcher();

        MockHttpServletRequest request = request("POST", "/sellers/me/products");
        request.setCookies(new Cookie("vnshop_rt", "refresh-token"));

        assertThat(matcher.matches(request)).isTrue();
    }

    private static RequestMatcher cookieAuthenticatedRequestMatcher() throws Exception {
        Method method = SecurityConfig.class.getDeclaredMethod("cookieAuthenticatedRequestMatcher");
        method.setAccessible(true);
        return (RequestMatcher) method.invoke(new SecurityConfig());
    }

    private static MockHttpServletRequest request(String method, String path) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setServletPath(path);
        return request;
    }
}
