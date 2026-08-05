package com.vnshop.userservice.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BuyerProfileTest {

    private static final PhoneNumber PHONE = new PhoneNumber("+84912345678");

    @Test
    void constructor_nullAddresses_createsEmptyList() {
        BuyerProfile p = new BuyerProfile("kc-1", "Alice", PHONE, "avatar", null);
        assertThat(p.addresses()).isEmpty();
    }

    @Test
    void constructor_blankKeycloakId_throws() {
        assertThatThrownBy(() -> new BuyerProfile("  ", "Alice", PHONE, "avatar", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("keycloakId");
    }

    @Test
    void constructor_tooManyAddresses_throws() {
        List<Address> addrs = List.of(
                new Address("S1", "W1", "D1", "C1", false),
                new Address("S2", "W2", "D2", "C2", false),
                new Address("S3", "W3", "D3", "C3", false),
                new Address("S4", "W4", "D4", "C4", false),
                new Address("S5", "W5", "D5", "C5", false),
                new Address("S6", "W6", "D6", "C6", false)
        );
        assertThatThrownBy(() -> new BuyerProfile("kc-1", "Alice", PHONE, "avatar", addrs))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("more than 5 addresses");
    }

    @Test
    void addAddress_atLimit_throws() {
        BuyerProfile p = new BuyerProfile("kc-1", "Alice", PHONE, "avatar", List.of(
                new Address("S1", "W1", "D1", "C1", false),
                new Address("S2", "W2", "D2", "C2", false),
                new Address("S3", "W3", "D3", "C3", false),
                new Address("S4", "W4", "D4", "C4", false),
                new Address("S5", "W5", "D5", "C5", false)
        ));
        assertThatThrownBy(() -> p.addAddress(new Address("S6", "W6", "D6", "C6", false)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("more than 5 addresses");
    }

    @Test
    void addAddress_nullAddress_throws() {
        BuyerProfile p = new BuyerProfile("kc-1", "Alice", PHONE, "avatar", null);
        assertThatThrownBy(() -> p.addAddress(null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void removeAddress_removesCorrectly() {
        Address addr = new Address("S1", "W1", "D1", "C1", false);
        BuyerProfile p = new BuyerProfile("kc-1", "Alice", PHONE, "avatar", List.of(addr));
        p.removeAddress(addr);
        assertThat(p.addresses()).isEmpty();
    }

    @Test
    void updateProfile_updatesFields() {
        BuyerProfile p = new BuyerProfile("kc-1", "Alice", PHONE, "avatar", null);
        PhoneNumber newPhone = new PhoneNumber("+84987654321");
        p.updateProfile("Bob", newPhone, "new-avatar");
        assertThat(p.name()).isEqualTo("Bob");
        assertThat(p.phone()).isEqualTo(newPhone);
        assertThat(p.avatarUrl()).isEqualTo("new-avatar");
    }

    @Test
    void constructor_withBannedTrue_initialFlagSet() {
        BuyerProfile p = new BuyerProfile("kc-1", null, "Alice", PHONE, "avatar", true, null);
        assertThat(p.banned()).isTrue();
        assertThat(p.email()).isNull();
    }

    @Test
    void ban_setsBannedTrue() {
        BuyerProfile p = new BuyerProfile("kc-1", "Alice", PHONE, "avatar", null);
        assertThat(p.banned()).isFalse();

        p.ban();

        assertThat(p.banned()).isTrue();
    }

    @Test
    void unban_setsBannedFalse() {
        BuyerProfile p = new BuyerProfile("kc-1", null, "Alice", PHONE, "avatar", true, null);
        assertThat(p.banned()).isTrue();

        p.unban();

        assertThat(p.banned()).isFalse();
    }

    @Test
    void email_returnsNormalizedValue() {
        BuyerProfile p = new BuyerProfile("kc-1", "  alice@example.com  ", "Alice", PHONE, "avatar", null);
        assertThat(p.email()).isEqualTo("alice@example.com");
    }

    @Test
    void backfillEmailIfMissing_seedsOnceAndNeverOverwrites() {
        BuyerProfile p = new BuyerProfile("kc-1", null, "Alice", PHONE, "avatar", null);

        assertThat(p.backfillEmailIfMissing("  registered@example.com  ")).isTrue();
        assertThat(p.email()).isEqualTo("registered@example.com");
        assertThat(p.backfillEmailIfMissing("changed@example.com")).isFalse();
        assertThat(p.email()).isEqualTo("registered@example.com");
    }

    @Test
    void backfillEmailIfMissing_ignoresBlankRecoveryValues() {
        BuyerProfile p = new BuyerProfile("kc-1", null, "Alice", PHONE, "avatar", null);

        assertThat(p.backfillEmailIfMissing("   ")).isFalse();
        assertThat(p.email()).isNull();
    }
}
