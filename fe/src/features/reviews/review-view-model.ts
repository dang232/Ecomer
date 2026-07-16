import type { Review } from "../../app/types/api";

export type ReviewPublicationOutcome = "published" | "pending" | "rejected";

export function reviewPublicationOutcome(status: string | undefined): ReviewPublicationOutcome {
  switch (status?.toUpperCase()) {
    case "APPROVED":
      return "published";
    case "REJECTED":
      return "rejected";
    default:
      return "pending";
  }
}

export function mergePublishedReview(
  current: readonly Review[],
  submitted: Review,
): readonly Review[] {
  if (reviewPublicationOutcome(submitted.status) !== "published") return current;
  return [submitted, ...current.filter(({ id }) => id !== submitted.id)];
}

export function formatReviewDate(
  value: string | undefined,
  locale: string,
  timeZone?: string,
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}
