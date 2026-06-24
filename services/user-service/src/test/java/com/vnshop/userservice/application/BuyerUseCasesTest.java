package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.PhoneNumber;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BuyerUseCasesTest {

 @Mock
 private UserRepositoryPort userRepositoryPort;

 private static final PhoneNumber PHONE = new PhoneNumber("+84912345678");

  private BuyerProfile buyer(String id) {
 return new BuyerProfile(id, "Alice", PHONE, "avatar", null);
 }

 // --- ViewBuyerProfileUseCase ---

 @Test
 void viewBuyer_happyPath_returnsBuyer() {
 BuyerProfile b = buyer("kc-1");
 when(userRepositoryPort.findBuyerByKeycloakId("kc-1")).thenReturn(Optional.of(b));

 ViewBuyerProfileUseCase useCase = new ViewBuyerProfileUseCase(userRepositoryPort);
 BuyerProfile result = useCase.view("kc-1");

 assertThat(result.keycloakId()).isEqualTo("kc-1");
 }

 @Test
 void viewBuyer_notFound_autoCreatesDefaultProfile() {
 // Keycloak-only users (registered directly in Keycloak, not via /auth/register)
 // get a default empty profile on first /users/me call. See commit c3f172a1.
 when(userRepositoryPort.findBuyerByKeycloakId("kc-1")).thenReturn(Optional.empty());
 when(userRepositoryPort.saveBuyer(any(BuyerProfile.class)))
 .thenAnswer(invocation -> invocation.getArgument(0));

 ViewBuyerProfileUseCase useCase = new ViewBuyerProfileUseCase(userRepositoryPort);
 BuyerProfile result = useCase.view("kc-1");

 assertThat(result.keycloakId()).isEqualTo("kc-1");
 assertThat(result.name()).isNull();
 assertThat(result.phone()).isNull();
 assertThat(result.avatarUrl()).isNull();
  assertThat(result.addresses()).isEmpty();
 verify(userRepositoryPort).saveBuyer(any(BuyerProfile.class));
 }

 // --- UpsertBuyerProfileUseCase (existing buyer branch) ---

 @Test
 void upsert_existingBuyer_updatesAndSaves() {
 BuyerProfile existing = buyer("kc-1");
 when(userRepositoryPort.findBuyerByKeycloakId("kc-1")).thenReturn(Optional.of(existing));
 when(userRepositoryPort.saveBuyer(existing)).thenReturn(existing);

 RegisterBuyerUseCase registerUseCase = new RegisterBuyerUseCase(userRepositoryPort);
 UpsertBuyerProfileUseCase useCase = new UpsertBuyerProfileUseCase(userRepositoryPort, registerUseCase);

 UpsertBuyerProfileCommand cmd = new UpsertBuyerProfileCommand("kc-1", "Bob", "+84987654321", "https://cdn.example.com/new-avatar.jpg");
 BuyerProfile result = useCase.upsert(cmd);

 assertThat(result.keycloakId()).isEqualTo("kc-1");
 verify(userRepositoryPort).saveBuyer(existing);
 }

 // --- UpsertBuyerProfileUseCase (new buyer branch) ---

 @Test
 void upsert_newBuyer_registersViaRegisterUseCase() {
 BuyerProfile saved = buyer("kc-2");
 when(userRepositoryPort.findBuyerByKeycloakId("kc-2")).thenReturn(Optional.empty());
 when(userRepositoryPort.saveBuyer(any())).thenReturn(saved);

 RegisterBuyerUseCase registerUseCase = new RegisterBuyerUseCase(userRepositoryPort);
 UpsertBuyerProfileUseCase useCase = new UpsertBuyerProfileUseCase(userRepositoryPort, registerUseCase);

 UpsertBuyerProfileCommand cmd = new UpsertBuyerProfileCommand("kc-2", "Carol", "+84912345678", "https://cdn.example.com/avatar.jpg");
 BuyerProfile result = useCase.upsert(cmd);

 assertThat(result.keycloakId()).isEqualTo("kc-2");
 verify(userRepositoryPort).saveBuyer(any());
 }

 // --- UpsertBuyerProfileUseCase (security) ---

 @Test
 void upsert_htmlInName_isStripped() {
 BuyerProfile existing = buyer("kc-xss");
 when(userRepositoryPort.findBuyerByKeycloakId("kc-xss")).thenReturn(Optional.of(existing));
 when(userRepositoryPort.saveBuyer(existing)).thenReturn(existing);

 RegisterBuyerUseCase registerUseCase = new RegisterBuyerUseCase(userRepositoryPort);
 UpsertBuyerProfileUseCase useCase = new UpsertBuyerProfileUseCase(userRepositoryPort, registerUseCase);

 UpsertBuyerProfileCommand cmd = new UpsertBuyerProfileCommand(
 "kc-xss", "Alice<script>alert(1)</script>", "+84912345678",
 "https://cdn.example.com/avatar.jpg");
 useCase.upsert(cmd);

 // The profile was updated with the sanitized name (no HTML tags)
 assertThat(existing.name()).doesNotContain("<script>");
 }

  @Test
 void upsert_privateIpAvatarUrl_throws() {
 RegisterBuyerUseCase registerUseCase = new RegisterBuyerUseCase(userRepositoryPort);
 UpsertBuyerProfileUseCase useCase = new UpsertBuyerProfileUseCase(userRepositoryPort, registerUseCase);

 UpsertBuyerProfileCommand cmd = new UpsertBuyerProfileCommand(
 "kc-ssrf", "Carol", "+84912345678", "http://169.254.169.254/latest/meta-data/");

 assertThatThrownBy(() -> useCase.upsert(cmd))
 .isInstanceOf(IllegalArgumentException.class)
 .hasMessageContaining("private or internal IP");
 }

 @Test
 void upsert_internalHostAvatarUrl_throws() {
 RegisterBuyerUseCase registerUseCase = new RegisterBuyerUseCase(userRepositoryPort);
 UpsertBuyerProfileUseCase useCase = new UpsertBuyerProfileUseCase(userRepositoryPort, registerUseCase);

 UpsertBuyerProfileCommand cmd = new UpsertBuyerProfileCommand(
 "kc-ssrf2", "Dave", "+84912345678", "http://localhost/admin");

 assertThatThrownBy(() -> useCase.upsert(cmd))
 .isInstanceOf(IllegalArgumentException.class)
 .hasMessageContaining("disallowed internal host");
 }

 // --- ListBuyerPublicProfilesUseCase ---

 @Test
 void listPublicProfiles_emptyInput_returnsEmptyWithoutHittingRepo() {
 ListBuyerPublicProfilesUseCase useCase = new ListBuyerPublicProfilesUseCase(userRepositoryPort);

 assertThat(useCase.list(null)).isEmpty();
 assertThat(useCase.list(List.of())).isEmpty();
 // No verify(repo) — null input must short-circuit before the repo call.
 }

 @Test
 void listPublicProfiles_happyPath_returnsRepoResultUnchanged() {
 BuyerProfile a = buyer("kc-A");
 BuyerProfile b = buyer("kc-B");
 when(userRepositoryPort.findBuyersByKeycloakIds(List.of("kc-A", "kc-B")))
 .thenReturn(List.of(a, b));

 ListBuyerPublicProfilesUseCase useCase = new ListBuyerPublicProfilesUseCase(userRepositoryPort);
 List<BuyerProfile> result = useCase.list(List.of("kc-A", "kc-B"));

 assertThat(result).hasSize(2);
 assertThat(result).extracting(BuyerProfile::keycloakId).containsExactly("kc-A", "kc-B");
 }
}
