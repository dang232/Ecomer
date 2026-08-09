/**
 * Typed capability matrix describing what controls each admin queue exposes.
 * Controls are derived from endpoint parameters, never from visual convention.
 */

export interface QueueCapabilities {
  search: boolean;
  status: boolean;
  sort: readonly string[];
  pagination: "server" | "client" | "none";
  selection: "single" | "multiple" | "none";
  actions: Readonly<Partial<Record<AdminQueueAction, MutationCapability>>>;
}

export interface MutationCapability {
  inputs: Readonly<Partial<Record<MutationInput, "required" | "optional">>>;
  rules?: readonly MutationValidationRule[];
}

export type MutationInput =
  | "reason"
  | "status"
  | "adminResolution"
  | "providerReference"
  | "attemptId"
  | "evidence"
  | "externalReference"
  | "evidenceHash"
  | "maskedDestinationConfirmed";

export interface MutationValidationRule {
  kind: "at-least-one";
  fields: readonly MutationInput[];
}

export type AdminQueueAction =
  | "cancel"
  | "refund"
  | "change-status"
  | "deactivate"
  | "ban"
  | "unban"
  | "approve"
  | "reject"
  | "approve-appeal"
  | "reject-appeal"
  | "resolve"
  | "submit"
  | "unknown"
  | "paid"
  | "legacy-complete"
  | "legacy-fail";

export const ADMIN_QUEUE_CAPABILITIES = {
  orders: {
    search: true,
    status: true,
    sort: [] as readonly string[],
    pagination: "server" as const,
    selection: "single" as const,
    actions: {
      cancel: { inputs: {} },
      refund: { inputs: { reason: "required" } },
      "change-status": { inputs: { status: "required" } },
    },
  },
  coupons: {
    search: false,
    status: false,
    sort: [] as readonly string[],
    pagination: "none" as const,
    selection: "single" as const,
    actions: {
      deactivate: { inputs: {} },
    },
  },
  users: {
    search: true,
    status: false,
    sort: [] as readonly string[],
    pagination: "server" as const,
    selection: "single" as const,
    actions: {
      ban: { inputs: {} },
      unban: { inputs: {} },
    },
  },
  sellers: {
    search: true,
    status: false,
    sort: [] as readonly string[],
    pagination: "server" as const,
    selection: "single" as const,
    actions: {
      approve: { inputs: {} },
      reject: { inputs: { reason: "required" } },
    },
  },
  reviews: {
    search: true,
    status: false,
    sort: [] as readonly string[],
    pagination: "server" as const,
    selection: "single" as const,
    actions: {
      approve: { inputs: {} },
      reject: { inputs: { reason: "required" } },
    },
  },
  disputes: {
    search: true,
    status: false,
    sort: [] as readonly string[],
    pagination: "server" as const,
    selection: "single" as const,
    actions: {
      resolve: { inputs: { adminResolution: "required" } },
    },
  },
  payouts: {
    search: true,
    status: true,
    sort: [] as readonly string[],
    pagination: "server" as const,
    selection: "single" as const,
    actions: {
      approve: { inputs: { reason: "required" } },
      reject: { inputs: { reason: "required" } },
      submit: {
        inputs: { providerReference: "required", attemptId: "required" },
      },
      unknown: { inputs: { reason: "required" } },
      paid: {
        inputs: { providerReference: "required", evidence: "required" },
      },
      "legacy-complete": {
        inputs: {
          reason: "required",
          externalReference: "required",
          evidenceHash: "required",
          maskedDestinationConfirmed: "required",
        },
      },
      "legacy-fail": {
        inputs: {
          reason: "required",
          externalReference: "optional",
          evidenceHash: "optional",
        },
        rules: [
          {
            kind: "at-least-one" as const,
            fields: ["externalReference", "evidenceHash"] as readonly MutationInput[],
          },
        ],
      },
    },
  },
  video: {
    search: false,
    status: false,
    sort: [] as readonly string[],
    pagination: "server" as const,
    selection: "single" as const,
    actions: {
      approve: { inputs: {} },
      reject: { inputs: { reason: "required" } },
      "approve-appeal": { inputs: {} },
      "reject-appeal": { inputs: { reason: "required" } },
    },
  },
} as const satisfies Record<string, QueueCapabilities>;
