package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.Address;
import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.PhoneNumber;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ManageAddressUseCaseTest {

    @Mock
    private UserRepositoryPort userRepositoryPort;

    private ManageAddressUseCase manageAddressUseCase;

    private static final String KEYCLOAK_ID = "user-123";
    private static final PhoneNumber PHONE = new PhoneNumber("+84912345678");

    @BeforeEach
    void setUp() {
        manageAddressUseCase = new ManageAddressUseCase(userRepositoryPort);
    }

    @Test
    void addAddress_ShouldAddAndSave_WhenBuyerExists() {
        BuyerProfile buyerProfile = createBuyerProfile();
        Address newAddress = new Address("Street 2", "Ward 2", "District 2", "City 2", false);
        when(userRepositoryPort.findBuyerByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(buyerProfile));
        when(userRepositoryPort.saveBuyer(any())).thenAnswer(invocation -> invocation.getArgument(0));

        BuyerProfile result = manageAddressUseCase.addAddress(KEYCLOAK_ID, newAddress);

        assertThat(result.addresses()).hasSize(2);
        assertThat(result.addresses()).contains(newAddress);
        verify(userRepositoryPort).saveBuyer(buyerProfile);
    }

    @Test
    void addAddress_ShouldThrowException_WhenBuyerNotFound() {
        Address newAddress = new Address("Street 2", "Ward 2", "District 2", "City 2", false);
        when(userRepositoryPort.findBuyerByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> manageAddressUseCase.addAddress(KEYCLOAK_ID, newAddress))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("buyer profile not found");
        verify(userRepositoryPort, never()).saveBuyer(any());
    }

    @Test
    void addAddress_ShouldThrowException_WhenMaxAddressesReached() {
        List<Address> addresses = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            addresses.add(new Address("Street " + i, "Ward " + i, "District " + i, "City " + i, false));
        }
        BuyerProfile buyerProfile = new BuyerProfile(KEYCLOAK_ID, "Name", PHONE, "avatar", addresses);
        Address extraAddress = new Address("Extra", "Extra", "Extra", "Extra", false);
        when(userRepositoryPort.findBuyerByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(buyerProfile));

        assertThatThrownBy(() -> manageAddressUseCase.addAddress(KEYCLOAK_ID, extraAddress))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("buyer profile cannot have more than 5 addresses");
        verify(userRepositoryPort, never()).saveBuyer(any());
    }

    @Test
    void removeAddress_ShouldRemoveAndSave_WhenBuyerExistsAndIndexValid() {
        BuyerProfile buyerProfile = createBuyerProfile();
        Address addressToRemove = buyerProfile.addresses().get(0);
        when(userRepositoryPort.findBuyerByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(buyerProfile));
        when(userRepositoryPort.saveBuyer(any())).thenAnswer(invocation -> invocation.getArgument(0));

        BuyerProfile result = manageAddressUseCase.removeAddress(KEYCLOAK_ID, 0);

        assertThat(result.addresses()).isEmpty();
        verify(userRepositoryPort).saveBuyer(buyerProfile);
    }

    @Test
    void removeAddress_ShouldThrowException_WhenBuyerNotFound() {
        when(userRepositoryPort.findBuyerByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> manageAddressUseCase.removeAddress(KEYCLOAK_ID, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("buyer profile not found");
        verify(userRepositoryPort, never()).saveBuyer(any());
    }

    @Test
    void removeAddress_ShouldThrowException_WhenIndexInvalid() {
        BuyerProfile buyerProfile = createBuyerProfile();
        when(userRepositoryPort.findBuyerByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(buyerProfile));

        assertThatThrownBy(() -> manageAddressUseCase.removeAddress(KEYCLOAK_ID, 1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("address index is invalid");

        assertThatThrownBy(() -> manageAddressUseCase.removeAddress(KEYCLOAK_ID, -1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("address index is invalid");

        verify(userRepositoryPort, never()).saveBuyer(any());
    }

    @Test
    void setDefaultAddress_ShouldUpdateAndSave_WhenBuyerExistsAndIndexValid() {
        List<Address> addresses = List.of(
                new Address("S1", "W1", "D1", "C1", true),
                new Address("S2", "W2", "D2", "C2", false)
        );
        BuyerProfile buyerProfile = new BuyerProfile(KEYCLOAK_ID, "Name", PHONE, "avatar", addresses);
        when(userRepositoryPort.findBuyerByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(buyerProfile));
        when(userRepositoryPort.saveBuyer(any())).thenAnswer(invocation -> invocation.getArgument(0));

        BuyerProfile result = manageAddressUseCase.setDefaultAddress(KEYCLOAK_ID, 1);

        assertThat(result.addresses()).hasSize(2);
        assertThat(result.addresses().get(0).isDefault()).isFalse();
        assertThat(result.addresses().get(1).isDefault()).isTrue();

        ArgumentCaptor<BuyerProfile> captor = ArgumentCaptor.forClass(BuyerProfile.class);
        verify(userRepositoryPort).saveBuyer(captor.capture());
        BuyerProfile savedProfile = captor.getValue();
        assertThat(savedProfile.addresses().get(1).isDefault()).isTrue();
    }

    @Test
    void setDefaultAddress_ShouldThrowException_WhenBuyerNotFound() {
        when(userRepositoryPort.findBuyerByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> manageAddressUseCase.setDefaultAddress(KEYCLOAK_ID, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("buyer profile not found");
        verify(userRepositoryPort, never()).saveBuyer(any());
    }

    @Test
    void setDefaultAddress_ShouldThrowException_WhenIndexInvalid() {
        BuyerProfile buyerProfile = createBuyerProfile();
        when(userRepositoryPort.findBuyerByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(buyerProfile));

        assertThatThrownBy(() -> manageAddressUseCase.setDefaultAddress(KEYCLOAK_ID, 1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("address index is invalid");

        verify(userRepositoryPort, never()).saveBuyer(any());
    }

    @Test
    void updateAddress_ShouldReplaceAddressAtIndexAndSave() {
        BuyerProfile buyerProfile = new BuyerProfile(
                KEYCLOAK_ID,
                "Name",
                PHONE,
                "avatar",
                List.of(
                        new Address("Old street", "W1", "D1", "C1", true),
                        new Address("Other street", "W2", "D2", "C2", false)
                )
        );
        Address replacement = new Address("New street", "W1", "D1", "C1", false);
        when(userRepositoryPort.findBuyerByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(buyerProfile));
        when(userRepositoryPort.saveBuyer(any())).thenAnswer(invocation -> invocation.getArgument(0));

        BuyerProfile result = manageAddressUseCase.updateAddress(KEYCLOAK_ID, 0, replacement);

        assertThat(result.addresses()).containsExactly(replacement, buyerProfile.addresses().get(1));
        verify(userRepositoryPort).saveBuyer(any(BuyerProfile.class));
    }

    private BuyerProfile createBuyerProfile() {
        Address address = new Address("Street 1", "Ward 1", "District 1", "City 1", true);
        return new BuyerProfile(KEYCLOAK_ID, "John Doe", PHONE, "http://avatar.url", List.of(address));
    }
}
