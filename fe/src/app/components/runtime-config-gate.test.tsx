import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppConfigQuery } from "../hooks/use-app-config";

import { RuntimeConfigGate } from "./runtime-config-gate";

vi.mock("../hooks/use-app-config", () => ({
  useAppConfigQuery: vi.fn(),
}));

const mockUseAppConfigQuery = vi.mocked(useAppConfigQuery);

describe("RuntimeConfigGate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows maintenance mode after a cold configuration failure", () => {
    mockUseAppConfigQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    } as ReturnType<typeof useAppConfigQuery>);

    render(
      <RuntimeConfigGate>
        <div>application</div>
      </RuntimeConfigGate>,
    );

    expect(screen.getByRole("heading", { name: "Service temporarily unavailable" })).toBeTruthy();
    expect(screen.queryByText("application")).toBeNull();
  });

  it("keeps the application mounted when a validated document exists", () => {
    mockUseAppConfigQuery.mockReturnValue({
      data: { schemaVersion: "1.0" },
      isPending: false,
      isError: true,
    } as ReturnType<typeof useAppConfigQuery>);

    render(
      <RuntimeConfigGate>
        <div>application</div>
      </RuntimeConfigGate>,
    );

    expect(screen.getByText("application")).toBeTruthy();
  });
});
