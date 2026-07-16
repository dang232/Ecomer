package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.domain.Address;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;

class AddressRequestTest {
    @Test
    void omittedDefaultFlagIsTreatedAsFalse() throws Exception {
        AddressRequest request = new ObjectMapper().readValue("""
                {
                  "street": "1 Nguyen Hue",
                  "ward": "Ben Nghe",
                  "district": "District 1",
                  "city": "Ho Chi Minh City"
                }
                """, AddressRequest.class);

        Address address = request.toDomain();

        assertThat(address.isDefault()).isFalse();
    }
}
