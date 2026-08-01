import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // Map keys used in the dialog to their English fallback strings so the
    // tests can locate buttons/labels without going through i18next.
    t: (key: string, opts?: { defaultValue?: string }) => {
      const dict: Record<string, string> = {
        "admin.payouts.dialogs.approve.title": "Approve payout",
        "admin.payouts.dialogs.approve.submit": "Approve",
        "admin.payouts.dialogs.reject.title": "Reject payout",
        "admin.payouts.dialogs.reject.submit": "Reject",
        "admin.payouts.dialogs.submit.title": "Submit payout",
        "admin.payouts.dialogs.submit.submit": "Submit",
        "admin.payouts.dialogs.unknown.title": "Mark as unknown",
        "admin.payouts.dialogs.unknown.submit": "Mark unknown",
        "admin.payouts.dialogs.paid.title": "Mark as paid",
        "admin.payouts.dialogs.paid.submit": "Mark paid",
        "admin.payouts.dialogs.legacy-complete.title": "Complete legacy payout",
        "admin.payouts.dialogs.legacy-complete.submit": "Complete",
        "admin.payouts.dialogs.legacy-fail.title": "Fail legacy payout",
        "admin.payouts.dialogs.legacy-fail.submit": "Fail",
        "common.confirm": "Confirm",
        "common.cancel": "Cancel",
        "admin.payouts.fields.reason": "Reason",
        "admin.payouts.fields.reasonOptional": "Reason (optional)",
        "admin.payouts.fields.reasonPlaceholder": "Reason for action...",
        "admin.payouts.fields.providerReference": "Provider reference",
        "admin.payouts.fields.attemptId": "Attempt id",
        "admin.payouts.fields.evidence": "Evidence",
        "admin.payouts.fields.externalReference": "External reference",
        "admin.payouts.fields.evidenceHash": "Evidence hash",
        "admin.queue.reasonRequired": "Reason is required",
        "admin.payouts.providerReferenceRequired": "Provider reference is required",
        "admin.payouts.attemptIdRequired": "Attempt id is required",
        "admin.payouts.evidenceRequired": "Evidence is required",
        "admin.payouts.legacyCompleteRequired": "External reference and evidence hash are required",
        "admin.payouts.legacyFailAtLeastOne":
          "At least one of external reference or evidence hash is required",
      };
      return dict[key] ?? opts?.defaultValue ?? key;
    },
    i18n: { language: "en" },
  }),
}));

import { PayoutDecisionDialog } from "./payout-decision-dialog";

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>;
}

describe("PayoutDecisionDialog", () => {
  it("renders the reject dialog and blocks confirm when reason is empty", () => {
    const onConfirm = vi.fn();
    render(
      <TestWrapper>
        <PayoutDecisionDialog
          variant="reject"
          payoutId="p-1"
          sellerLabel="Alice Shop"
          amountLabel="150,000 ₫"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />
      </TestWrapper>,
    );
    expect(screen.getByText(/Reject payout/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm with trimmed reason when reject has a reason", () => {
    const onConfirm = vi.fn();
    render(
      <TestWrapper>
        <PayoutDecisionDialog
          variant="reject"
          payoutId="p-1"
          sellerLabel="Alice Shop"
          amountLabel="150,000 ₫"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />
      </TestWrapper>,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  bad destination  " } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ reason: "bad destination" }));
  });

  it("submit requires providerReference and attemptId", () => {
    const onConfirm = vi.fn();
    render(
      <TestWrapper>
        <PayoutDecisionDialog
          variant="submit"
          payoutId="p-1"
          sellerLabel="Alice"
          amountLabel="150,000 ₫"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText("Submit"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("legacy-complete passes maskedDestinationConfirmed: true", () => {
    const onConfirm = vi.fn();
    render(
      <TestWrapper>
        <PayoutDecisionDialog
          variant="legacy-complete"
          payoutId="p-1"
          sellerLabel="Alice"
          amountLabel="150,000 ₫"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />
      </TestWrapper>,
    );
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "ok" } });
    fireEvent.change(inputs[1], { target: { value: "BANK-1" } });
    fireEvent.change(inputs[2], { target: { value: "sha256:abc" } });
    fireEvent.click(screen.getByText("Complete"));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        maskedDestinationConfirmed: true,
        externalReference: "BANK-1",
        evidenceHash: "sha256:abc",
      }),
    );
  });

  it("legacy-fail requires at least one of externalReference/evidenceHash", () => {
    const onConfirm = vi.fn();
    render(
      <TestWrapper>
        <PayoutDecisionDialog
          variant="legacy-fail"
          payoutId="p-1"
          sellerLabel="Alice"
          amountLabel="150,000 ₫"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />
      </TestWrapper>,
    );
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Bank declined" } });
    fireEvent.click(screen.getByRole("button", { name: "Fail" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("legacy-fail passes externalReference when only externalReference supplied", () => {
    const onConfirm = vi.fn();
    render(
      <TestWrapper>
        <PayoutDecisionDialog
          variant="legacy-fail"
          payoutId="p-1"
          sellerLabel="Alice"
          amountLabel="150,000 ₫"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />
      </TestWrapper>,
    );
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Bank declined" } });
    fireEvent.change(screen.getByLabelText("External reference"), {
      target: { value: "BANK-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fail" }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ externalReference: "BANK-1" }),
    );
  });
});
