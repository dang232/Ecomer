import { render, screen, fireEvent } from "@testing-library/react";
import { Toaster } from "sonner";
import { describe, expect, it, vi } from "vitest";

import { FormDialog, type FormField } from "./form-dialog";

const baseFields: FormField[] = [
  { key: "reason", label: "Lý do từ chối", type: "textarea", required: true },
];

function renderDialog(props: Partial<React.ComponentProps<typeof FormDialog>> = {}) {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  const utils = render(
    <>
      <Toaster />
      <FormDialog
        open
        title="Test dialog"
        submitLabel="Gửi"
        fields={baseFields}
        onClose={onClose}
        onSubmit={onSubmit}
        {...props}
      />
    </>,
  );
  return { ...utils, onClose, onSubmit };
}

describe("FormDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <FormDialog
        open={false}
        title="Hidden"
        submitLabel="x"
        fields={baseFields}
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders title, fields, and submit label when open", () => {
    renderDialog({ title: "Yêu cầu trả hàng", submitLabel: "Gửi yêu cầu" });
    expect(screen.getByText("Yêu cầu trả hàng")).toBeInTheDocument();
    expect(screen.getByText("Lý do từ chối")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gửi yêu cầu" })).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const { onClose } = renderDialog();
    const closeBtn = screen
      .getAllByRole("button")
      .find((b) => b.className.includes("rounded-full"));
    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the Huỷ button is clicked", () => {
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onSubmit when a required field is empty", () => {
    const { onSubmit } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits trimmed values when all required fields are filled", () => {
    const { onSubmit } = renderDialog({
      fields: [
        {
          key: "reason",
          label: "Lý do từ chối",
          type: "textarea",
          placeholder: "Nội dung không phù hợp...",
          required: true,
        },
      ],
    });
    const textarea = screen.getByPlaceholderText("Nội dung không phù hợp...");
    fireEvent.change(textarea, { target: { value: "  Hết hàng  " } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ reason: "Hết hàng" });
  });

  it("treats fields with required:false as optional and still submits", () => {
    const { onSubmit } = renderDialog({
      fields: [
        { key: "resolution", label: "Quyết định", required: true, type: "textarea" },
        { key: "amount", label: "Số tiền", required: false, type: "number" },
      ],
    });
    const textareas = screen.getAllByRole("textbox");
    // First textbox is the textarea, second is the optional number input.
    fireEvent.change(textareas[0], { target: { value: "Hoàn 50%" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
    expect(onSubmit).toHaveBeenCalledWith({ resolution: "Hoàn 50%", amount: "" });
  });

  it("disables the submit button while isSubmitting is true", () => {
    renderDialog({ isSubmitting: true });
    const submitBtn = screen.getByRole("button", { name: /Đang xử lý/ });
    expect(submitBtn).toBeDisabled();
  });

  it("renders helper text under fields when provided", () => {
    renderDialog({
      fields: [
        {
          key: "amount",
          label: "Số tiền",
          required: false,
          type: "number",
          helper: "Để trống nếu không hoàn tiền.",
        },
      ],
    });
    expect(screen.getByText("Để trống nếu không hoàn tiền.")).toBeInTheDocument();
  });

  // --- Withdraw-form live-validation tests (WS-4: P0-11, P1-6, P1-9) ---

  it("shows field error and aria-invalid when amount field validate fails", () => {
    renderDialog({
      fields: [
        {
          key: "amount",
          label: "Amount",
          type: "number",
          required: true,
          validate: (v) => {
            const n = Number(v.replace(/\D/g, ""));
            if (!n || n <= 0) return "Invalid amount";
            if (n > 500000) return "Exceeds balance";
            return undefined;
          },
        },
      ],
    });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "1000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Exceeds balance");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("shows field error and aria-invalid when bank account fails regex validation", () => {
    renderDialog({
      fields: [
        {
          key: "bankAccount",
          label: "Bank account",
          type: "text",
          required: true,
          validate: (v) => {
            if (!/^\d{6,19}$/.test(v.trim())) return "Bank account must be 6-19 digits";
            return undefined;
          },
        },
      ],
    });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "abc123" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Bank account must be 6-19 digits");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("calls onSubmit with trimmed values when all fields pass validation", () => {
    const { onSubmit } = renderDialog({
      fields: [
        {
          key: "amount",
          label: "Amount",
          type: "number",
          required: true,
          validate: (v) => {
            const n = Number(v.replace(/\D/g, ""));
            if (!n || n <= 0) return "Invalid amount";
            if (n > 500000) return "Exceeds balance";
            return undefined;
          },
        },
        {
          key: "bankAccount",
          label: "Bank account",
          type: "text",
          required: true,
          validate: (v) => {
            if (!/^\d{6,19}$/.test(v.trim())) return "Bank account must be 6-19 digits";
            return undefined;
          },
        },
      ],
    });
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "100000" } });
    fireEvent.change(inputs[1], { target: { value: "1234567890123" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ amount: "100000", bankAccount: "1234567890123" });
  });
});
