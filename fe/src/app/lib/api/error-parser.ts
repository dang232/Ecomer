import { ApiError } from "./envelope";

/**
 * Standard VNShop error response shape returned by all services.
 * Matches: { code, message, details, timestamp, traceId }
 *
 * Older services may still return the legacy envelope shape:
 * { success, message, errorCode, data, timestamp }
 * This parser handles both.
 */
export interface ParsedApiError {
  /** Machine-readable error code, e.g. "ORDER_NOT_FOUND". */
  code: string;
  /** User-facing message. Never a raw JSON stack trace. */
  message: string;
  /** Optional field-level validation details. */
  details: string[];
  /** OTEL traceId for support correlation. May be null. */
  traceId: string | null;
}

/**
 * Parse any error thrown by the API client into a `ParsedApiError`.
 *
 * - If the error is an `ApiError`, its `errorCode` and `message` are used.
 * - If the raw body is available and matches the standard shape, `details`
 *   and `traceId` are extracted.
 * - For any other `Error`, the message is used with code "CLIENT_ERROR".
 * - Fallback for unknown types returns a generic message.
 *
 * Never surfaces raw JSON or stack traces — safe to display directly in UI.
 */
export function parseApiError(error: unknown): ParsedApiError {
  if (error instanceof ApiError) {
    return {
      code: error.errorCode ?? "UNKNOWN_ERROR",
      message: sanitizeMessage(error.message),
      details: [],
      traceId: error.correlationId ?? null,
    };
  }

  if (error instanceof Error) {
    return {
      code: "CLIENT_ERROR",
      message: sanitizeMessage(error.message),
      details: [],
      traceId: null,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "An unexpected error occurred. Please try again.",
    details: [],
    traceId: null,
  };
}

/**
 * Extract a user-friendly message string from `parseApiError` output.
 * Falls back to a generic message when the parsed message is empty or
 * looks like a raw technical error.
 */
export function getUserFacingMessage(error: unknown): string {
  const parsed = parseApiError(error);
  return parsed.message || "Something went wrong. Please try again.";
}

/**
 * Map a standard error code to a human-readable label for use in toasts,
 * inline messages, or error pages.
 *
 * Falls back to the raw message from parseApiError for codes not listed here.
 */
export function getErrorLabel(error: unknown): string {
  const parsed = parseApiError(error);
  const label = ERROR_CODE_LABELS[parsed.code];
  return label ?? parsed.message;
}

/** Lookup table for well-known error codes → user-friendly labels. */
const ERROR_CODE_LABELS: Record<string, string> = {
  // Auth
  UNAUTHORIZED: "Please sign in to continue.",
  FORBIDDEN: "You don't have permission to do that.",
  PAYMENT_ACCESS_DENIED: "You don't have permission to access this payment.",
  ORDER_ACCESS_DENIED: "You don't have permission to access this order.",
  INVOICE_ACCESS_DENIED: "You don't have permission to access this invoice.",
  INVALID_SIGNATURE: "Request signature is invalid.",

  // Order
  ORDER_NOT_FOUND: "Order not found.",
  PRODUCT_NOT_FOUND: "One or more products could not be found.",
  PRODUCT_CATALOG_UNAVAILABLE:
    "Product catalog is temporarily unavailable. Please try again shortly.",
  ORDER_NOT_PAYABLE: "This order cannot be paid at this time.",

  // Payment
  PAYMENT_NOT_REFUNDABLE: "This payment cannot be refunded.",
  UNSUPPORTED_PAYMENT_METHOD: "Payment method is not supported.",
  IDEMPOTENCY_KEY_CONFLICT: "A duplicate request was detected. Please refresh and try again.",
  CHARGEBACK_NOT_FOUND: "Chargeback record not found.",

  // Cart
  CART_FULL: "Your cart is full. Remove an item before adding more.",
  CART_ITEM_LIMIT_EXCEEDED: "Cart item limit exceeded.",
  CART_ITEM_NOT_FOUND: "Item not found in cart.",
  INVALID_CART_OPERATION: "Invalid cart operation.",
  CART_VERSION_CONFLICT: "Your cart was updated elsewhere. Please refresh.",
  CART_UNAVAILABLE: "Cart service is temporarily unavailable. Please try again shortly.",

  // Validation / generic
  VALIDATION_ERROR: "Some fields are invalid. Please review and try again.",
  BAD_REQUEST: "Invalid request. Please check your input.",
  INTERNAL_ERROR: "An unexpected server error occurred. Please try again later.",
  SERVICE_UNAVAILABLE: "Service is temporarily unavailable. Please try again shortly.",
};

/**
 * Strip anything that looks like a raw JSON blob, stack trace line, or
 * internal path from a message before showing it to users.
 */
function sanitizeMessage(message: string): string {
  if (!message) return "An unexpected error occurred. Please try again.";
  // If the message contains a stack trace marker, replace with generic text.
  if (message.includes("    at ") || message.includes("\tat ")) {
    return "An unexpected error occurred. Please try again.";
  }
  // If the message starts with a JSON object/array, don't expose it.
  const trimmed = message.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "An unexpected error occurred. Please try again.";
  }
  return message;
}
