/** Tests for ReturnRequestPage */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: any) => createElement("div", props, children),
  },
}));

const requestReturnMock = vi.fn();

vi.mock("../lib/api/endpoints/returns", () => ({
  requestReturn: (...args: unknown[]) => requestReturnMock(...args),
  RETURN_REASON_VALUES: ["damaged", "wrong_item", "changed_mind", "not_as_described", "other"],
}));

vi.mock("../lib/api", () => ({
  ApiError: class ApiError extends Error {
    constructor(public message: string) {
      super(message);
    }
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      let value = typeof opts?.defaultValue === "string" ? opts.defaultValue : key;
      for (const [name, replacement] of Object.entries(opts ?? {})) {
        if (name !== "defaultValue") {
          value = value.replaceAll(`{{${name}}}`, String(replacement));
        }
      }
      return value;
    },
    i18n: { resolvedLanguage: "en" },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  queryOptions: (opts: any) => opts,
  useMutation: vi.fn(() => ({
    mutate: requestReturnMock,
    mutateAsync: requestReturnMock,
    isPending: false,
  })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { ReturnRequestPage } from "./ReturnRequestPage";

const renderWithRouter = (ui: ReactNode) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe("ReturnRequestPage", () => {
  beforeEach(() => {
    requestReturnMock.mockReset();
    vi.clearAllMocks();
  });

  it("renders the page title", () => {
    renderWithRouter(<ReturnRequestPage />);

    expect(screen.getByText("return.request.title")).toBeInTheDocument();
  });

  it("renders form fields", () => {
    renderWithRouter(<ReturnRequestPage />);

    expect(screen.getByLabelText(/orderIdLabel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reasonLabel/i)).toBeInTheDocument();
  });

  it("renders pickup type options", () => {
    renderWithRouter(<ReturnRequestPage />);

    // The pickup/dropoff options are rendered as radio button labels
    expect(screen.getAllByText(/pickup/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/dropoff/i).length).toBeGreaterThan(0);
  });

  it("renders submit button", () => {
    renderWithRouter(<ReturnRequestPage />);

    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });

  it("shows validation error when submitting without subOrderId", async () => {
    const { toast } = await import("sonner");
    renderWithRouter(<ReturnRequestPage />);

    const submitButton = screen.getByRole("button", { name: /submit/i });
    submitButton.click();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("return.request.selectOrder");
    });
  });

  it("shows validation error when submitting without reason", async () => {
    const { toast } = await import("sonner");
    renderWithRouter(<ReturnRequestPage />);

    const subOrderInput = screen.getByLabelText(/orderIdLabel/i);
    fireEvent.change(subOrderInput, { target: { value: "sub-123" } });

    const submitButton = screen.getByRole("button", { name: /submit/i });
    submitButton.click();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("return.request.selectReason");
    });
  });

  it("calls API when form is valid", async () => {
    requestReturnMock.mockResolvedValue({ id: "ret-1", status: "REQUESTED" });

    renderWithRouter(<ReturnRequestPage />);

    const subOrderInput = screen.getByLabelText(/orderIdLabel/i);
    fireEvent.change(subOrderInput, { target: { value: "sub-123" } });

    const reasonSelect = screen.getByLabelText(/reasonLabel/i);
    fireEvent.change(reasonSelect, { target: { value: "damaged" } });

    const submitButton = screen.getByRole("button", { name: /submit/i });
    submitButton.click();

    await waitFor(() => {
      expect(requestReturnMock).toHaveBeenCalled();
    });
  });
});
