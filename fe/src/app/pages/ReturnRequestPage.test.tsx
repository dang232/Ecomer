/** Tests for ReturnRequestPage */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { HTMLAttributes, ReactNode } from "react";
import { createElement } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: MotionDivProps) => createElement("div", props, children),
  },
}));

type UnknownCall = (...args: unknown[]) => unknown;

const requestReturnMock = vi.fn<UnknownCall>();

vi.mock("@/shared/api/endpoints/returns", () => ({
  requestReturn: (...args: unknown[]) => requestReturnMock(...args),
  RETURN_REASON_VALUES: ["damaged", "wrong_item", "changed_mind", "not_as_described", "other"],
}));

vi.mock("@/shared/api", () => ({
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
  queryOptions: passthrough,
  useQuery: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
  })),
  useMutation: vi.fn(() => ({
    mutate: requestReturnMock,
    mutateAsync: requestReturnMock,
    isPending: false,
  })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

function passthrough<T>(options: T): T {
  return options;
}

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

    expect(screen.getByLabelText(/package/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/return reason/i)).toBeInTheDocument();
  });

  it("renders pickup type options", () => {
    renderWithRouter(<ReturnRequestPage />);

    expect(screen.getByText(/carrier pickup/i)).toBeInTheDocument();
    expect(screen.getByText(/drop off/i)).toBeInTheDocument();
  });

  it("renders submit button", () => {
    renderWithRouter(<ReturnRequestPage />);

    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });

  it("shows validation error when submitting without subOrderId", async () => {
    renderWithRouter(<ReturnRequestPage />);

    const submitButton = screen.getByRole("button", { name: /submit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("return.request.selectOrder")).toBeInTheDocument();
    });
  });

  it("shows validation error when submitting without reason", async () => {
    renderWithRouter(<ReturnRequestPage />);

    const subOrderInput = screen.getByLabelText(/package/i);
    fireEvent.change(subOrderInput, { target: { value: "sub-123" } });

    const submitButton = screen.getByRole("button", { name: /submit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("return.request.reasonTooShort")).toBeInTheDocument();
    });
  });

  it("calls API when form is valid", async () => {
    requestReturnMock.mockResolvedValue({ id: "ret-1", status: "REQUESTED" });

    renderWithRouter(<ReturnRequestPage />);

    const subOrderInput = screen.getByLabelText(/package/i);
    fireEvent.change(subOrderInput, { target: { value: "sub-123" } });

    const reasonField = screen.getByLabelText(/return reason/i);
    fireEvent.change(reasonField, {
      target: { value: "The item arrived damaged and the box was crushed." },
    });

    const submitButton = screen.getByRole("button", { name: /submit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(requestReturnMock).toHaveBeenCalled();
    });
  });
});
