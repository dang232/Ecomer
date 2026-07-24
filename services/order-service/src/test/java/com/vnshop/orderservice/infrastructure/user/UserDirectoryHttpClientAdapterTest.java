package com.vnshop.orderservice.infrastructure.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

class UserDirectoryHttpClientAdapterTest {

    @Test
    void acceptsCanonicalAndPublicSellerProjectionFields() {
        UserDirectoryHttpClient client = mock(UserDirectoryHttpClient.class);
        when(client.listSellerProfiles(anyList()))
                .thenReturn("""
                        {"success":true,"data":[
                          {"sellerId":"seller-1","displayName":"Audio Shop"},
                          {"id":"seller-2","shopName":"Camera Shop"}
                        ]}
                        """);

        UserDirectoryHttpClientAdapter adapter =
                new UserDirectoryHttpClientAdapter(client, new ObjectMapper());

        Map<String, String> names = adapter.lookup(Set.of(), Set.of("seller-1", "seller-2"))
                .sellerNames();

        assertThat(names).containsExactlyInAnyOrderEntriesOf(Map.of(
                "seller-1", "Audio Shop",
                "seller-2", "Camera Shop"));
    }
}
