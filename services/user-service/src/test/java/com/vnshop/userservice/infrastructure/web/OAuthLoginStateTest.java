package com.vnshop.userservice.infrastructure.web;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OAuthLoginStateTest {
    private StringRedisTemplate redisTemplate;
    private ValueOperations<String, String> valueOperations;
    private ObjectMapper objectMapper;
    private OAuthLoginState oauthLoginState;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        redisTemplate = mock(StringRedisTemplate.class);
        valueOperations = mock(ValueOperations.class);
        objectMapper = new ObjectMapper();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        oauthLoginState = new OAuthLoginState(redisTemplate, objectMapper);
    }

    @Test
    void createStoresStateWithTenMinuteExpiry() throws Exception {
        OAuthLoginState.StateWithChallenge created =
                oauthLoginState.createStateWithChallenge("google", "/product/p1?ref=wishlist");

        ArgumentCaptor<String> serialized = ArgumentCaptor.forClass(String.class);
        verify(valueOperations).set(
                org.mockito.ArgumentMatchers.eq("auth:oauth:state:" + created.state()),
                serialized.capture(),
                org.mockito.ArgumentMatchers.eq(Duration.ofMinutes(10)));

        OAuthLoginState.StateRecord stored =
                objectMapper.readValue(serialized.getValue(), OAuthLoginState.StateRecord.class);
        assertThat(stored.provider()).isEqualTo("google");
        assertThat(stored.returnTo()).isEqualTo("/product/p1?ref=wishlist");
        assertThat(stored.codeVerifier()).isNotBlank();
        assertThat(created.codeChallenge()).isEqualTo(stored.codeChallenge());
    }

    @Test
    void consumeUsesAtomicGetAndDelete() throws Exception {
        OAuthLoginState.StateRecord record =
                new OAuthLoginState.StateRecord("google", "verifier", "challenge", "/orders");
        when(valueOperations.getAndDelete(anyString()))
                .thenReturn(objectMapper.writeValueAsString(record));

        OAuthLoginState.StateRecord consumed = oauthLoginState.consumeState("state-token");

        assertThat(consumed).isEqualTo(record);
        verify(valueOperations).getAndDelete("auth:oauth:state:state-token");
    }

    @Test
    void consumeReturnsNullForMissingOrExpiredState() {
        when(valueOperations.getAndDelete(anyString())).thenReturn(null);

        assertThat(oauthLoginState.consumeState("missing")).isNull();
    }
}
