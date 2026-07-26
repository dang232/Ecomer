package com.vnshop.userservice.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class EnrollDestinationCommandTest {

    @Test
    void toStringRedactsBankAccount() {
        EnrollDestinationCommand command =
                new EnrollDestinationCommand("seller-1", "Vietcombank", "1234567890");

        assertThat(command.toString()).doesNotContain("1234567890");
        assertThat(command.toString()).contains("REDACTED");
    }
}
