/** Test for spec U-9: address mutations must use stable identity, not array index. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, Suspense } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const useAuthMock = vi.fn();
const myProfileMock = vi.fn();
const setDefaultAddressMock = vi.fn();
const removeAddressMock = vi.fn();
const addAddressMock = vi.fn();

vi.mock("../hooks/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../lib/api/endpoints/users", () => ({
  myProfile: (...args: unknown[]) => myProfileMock(...args),
  setDefaultAddress: (...args: unknown[]) => setDefaultAddressMock(...args),
  removeAddress: (...args: unknown[]) => removeAddressMock(...args),
  addAddress: (...args: unknown[]) => addAddressMock(...args),
  updateProfile: vi.fn(),
  avatarUpload: vi.fn(),
  avatarActivate: vi.fn(),
}));

vi.mock("../hooks/use-avatar-upload", () => ({
  useAvatarUpload: () => ({ mutate: vi.fn(), isPending: false }),
  avatarUploadErrorMessage: () => "error",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (typeof opts?.defaultValue === "string") return opts.defaultValue;
      return key;
    },
    i18n: { resolvedLanguage: "en" },
  }),
  initReactI18next: {
    type: "3rdParty",
    init: () => {
      return void 0;
    },
  },
}));

import { ErrorBoundary } from "../components/error-boundary";

import { ProfilePage } from "./ProfilePage";

const ADDRESS_1 = {
  street: "12 Lê Lợi",
  ward: "Bến Nghé",
  district: "Quận 1",
  city: "Hồ Chí Minh",
  phone: "0901234567",
  isDefault: true,
};
const ADDRESS_2 = {
  street: "24 Trần Hưng Đạo",
  ward: "Phan Chu Trinh",
  district: "Quận 1",
  city: "Hồ Chí Minh",
  phone: "0907654321",
  isDefault: false,
};

const PROFILE = {
  id: "kc-1",
  name: "Test User",
  email: "test@example.com",
  phone: "0900000000",
  avatar: null,
  addresses: [ADDRESS_1, ADDRESS_2],
};

// NOTE: ProfilePage requires custom gcTime/staleTime and prefetchProfile setup,
// so this local wrapper is intentionally kept distinct from the shared helper.
function makeWrapper(prefetchProfile: unknown) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  // Pre-populate the cache so useSuspenseQuery resolves synchronously.
  if (prefetchProfile !== undefined) {
    client.setQueryData(["users", "me"], prefetchProfile);
  }
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/profile"]}>
          <ErrorBoundary>
            <Suspense fallback={<div>Loading…</div>}>{children}</Suspense>
          </ErrorBoundary>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return { Wrapper, client };
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    ready: true,
    authenticated: true,
    profile: { id: "kc-1", email: "test@example.com", username: "testuser" },
    logout: vi.fn(),
  });
  myProfileMock.mockReset();
  setDefaultAddressMock.mockReset();
  removeAddressMock.mockReset();
  addAddressMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ProfilePage — address mutations (spec U-9)", () => {
  it("identifies the address being set as default by stable content key, not by array index", async () => {
    // First render: ADDRESS_1 is default at index 0, ADDRESS_2 is not at index 1.
    myProfileMock.mockResolvedValue(PROFILE);
    // Spec U-9: the page must identify the address by a stable key, not the
    // current array index. We assert the call argument is a STRING (the key),
    // not a NUMBER (the index).
    setDefaultAddressMock.mockImplementation((arg: unknown) => {
      // The mock returns a profile where the targeted address (matched by
      // content) is now the default. This lets the test verify the FE
      // correctly identified which address to mutate even after the BE shape
      // shift.
      const addresses = PROFILE.addresses.map((a) => ({ ...a }));
      const argKey = String(arg);
      const target = addresses.find(
        (a) => `${a.street}|${a.ward ?? ""}|${a.district ?? ""}|${a.city}` === argKey,
      );
      if (!target) {
        return Promise.reject(new Error(`unknown address key: ${argKey}`));
      }
      const updated = addresses.map((a) => ({ ...a, isDefault: a === target }));
      return Promise.resolve({ ...PROFILE, addresses: updated });
    });

    const { Wrapper } = makeWrapper(PROFILE);
    render(<ProfilePage />, { wrapper: Wrapper });

    // Default tab is "info"; switch to "addresses" first.
    const addressesTab = await screen.findByText("profile.tabs.addresses", {}, { timeout: 5000 });
    fireEvent.click(addressesTab);

    // Wait for the addresses to appear (the page shows the joined address line).
    await waitFor(() => expect(screen.getByText(/24 Trần Hưng Đạo/)).toBeInTheDocument(), {
      timeout: 5000,
    });

    // The "Set as default" button is rendered for the non-default address.
    const setDefaultButtons = await screen.findAllByRole("button", {
      name: /profile\.addresses\.setDefault/i,
    });
    expect(setDefaultButtons).toHaveLength(1);

    fireEvent.click(setDefaultButtons[0]);

    // Spec U-9: the mutation receives a stable string key, not a numeric index.
    await waitFor(() => expect(setDefaultAddressMock).toHaveBeenCalledTimes(1));
    const callArg = setDefaultAddressMock.mock.calls[0][0];
    expect(typeof callArg).toBe("string");
    expect(String(callArg)).toContain(ADDRESS_2.street);

    // After the mutation resolves, the right address is now the default.
    await waitFor(() =>
      expect(screen.getAllByText("profile.addresses.isDefaultBadge")).toHaveLength(1),
    );
  });
});
