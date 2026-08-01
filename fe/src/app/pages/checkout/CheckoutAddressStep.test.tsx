import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Address } from "@/shared/contracts/api";

import { CheckoutAddressStep } from "./CheckoutAddressStep";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const addresses: Address[] = [
  {
    id: "addr-1",
    street: "12 Lê Lợi",
    ward: "Bến Nghé",
    district: "Quận 1",
    city: "Hồ Chí Minh",
    isDefault: true,
  },
  {
    id: "addr-2",
    street: "5 Hai Bà Trưng",
    ward: undefined,
    district: "Quận 3",
    city: "Hồ Chí Minh",
    isDefault: false,
  },
];

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const baseProps = {
  buyerName: "Mai Nguyen",
  isLoading: false,
  refetchAddresses: vi.fn().mockResolvedValue(undefined),
};

describe("CheckoutAddressStep", () => {
  it('renders a real <input type="radio"> per address (no buttons-as-radios)', () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CheckoutAddressStep
          {...baseProps}
          addresses={addresses}
          selectedAddressIndex={0}
          setSelectedAddressIndex={vi.fn()}
        />
      </Wrapper>,
    );

    const radios = screen.getAllByRole<HTMLInputElement>("radio");
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio.tagName).toBe("INPUT");
       expect(radio.type).toBe("radio");
    }
  });

  it("marks the selected address as checked and shares a name across the group", () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CheckoutAddressStep
          {...baseProps}
          addresses={addresses}
          selectedAddressIndex={1}
          setSelectedAddressIndex={vi.fn()}
        />
      </Wrapper>,
    );

    const radios = screen.getAllByRole<HTMLInputElement>("radio");
    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);

    // Real radios in a group share a name → arrow-key navigation works.
    expect(radios[0].name).toBe(radios[1].name);
    expect(radios[0].name).toBe("checkout-address");
  });

  it("calls setSelectedAddressIndex when a radio is changed (e.g. by arrow keys)", () => {
    const setSelectedAddressIndex = vi.fn();
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CheckoutAddressStep
          {...baseProps}
          addresses={addresses}
          selectedAddressIndex={0}
          setSelectedAddressIndex={setSelectedAddressIndex}
        />
      </Wrapper>,
    );

    const radios = screen.getAllByRole<HTMLInputElement>("radio");
    // Real radios fire `change` on arrow-key nav in the browser. Clicking an
    // unchecked radio sets it to checked and dispatches change.
    fireEvent.click(radios[1]);
    expect(setSelectedAddressIndex).toHaveBeenCalledWith(1);
  });

  it("focusable radio inputs are in the natural tab order", () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CheckoutAddressStep
          {...baseProps}
          addresses={addresses}
          selectedAddressIndex={0}
          setSelectedAddressIndex={vi.fn()}
        />
      </Wrapper>,
    );

    const radios = screen.getAllByRole<HTMLInputElement>("radio");
    // Both share a name → they participate in a single arrow-key group.
    expect(radios[0].name).toBe(radios[1].name);
    // Native <input type="radio"> without an explicit tabIndex attribute is in
    // the document tab order (browser-default tabIndex = 0). Confirm no
    // negative tabIndex is set in the markup.
    for (const radio of radios) {
      expect(radio.getAttribute("tabindex")).toBeNull();
    }
  });

  it("wraps each address card in a <label> so the whole card is clickable", () => {
    const setSelectedAddressIndex = vi.fn();
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CheckoutAddressStep
          {...baseProps}
          addresses={addresses}
          selectedAddressIndex={0}
          setSelectedAddressIndex={setSelectedAddressIndex}
        />
      </Wrapper>,
    );

    const radio0 = screen.getAllByRole<HTMLInputElement>("radio")[0];
    const label = radio0.closest("label");
    expect(label).not.toBeNull();
    expect(label!.getAttribute("for")).toBe(radio0.id);
  });

  it("exposes the radiogroup role on the wrapper with an aria-label", () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CheckoutAddressStep
          {...baseProps}
          addresses={addresses}
          selectedAddressIndex={0}
          setSelectedAddressIndex={vi.fn()}
        />
      </Wrapper>,
    );

    const group = screen.getByRole("radiogroup", { name: "Delivery address" });
    expect(group).toBeInTheDocument();
  });
});
