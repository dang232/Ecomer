export const ACCOUNT_SECTION_VALUES = [
  "profile",
  "wishlist",
  "notifications",
  "messages",
  "returns",
] as const;

export type AccountSection = (typeof ACCOUNT_SECTION_VALUES)[number];

export interface AccountRouteState {
  section: AccountSection;
  href: string;
}

const SECTION_BY_PATHNAME: ReadonlyArray<{ prefix: string; section: AccountSection }> = [
  { prefix: "/profile", section: "profile" },
  { prefix: "/wishlist", section: "wishlist" },
  { prefix: "/notifications", section: "notifications" },
  { prefix: "/messages", section: "messages" },
  { prefix: "/returns", section: "returns" },
];

export function readAccountRouteState(pathname: string): AccountRouteState {
  const match = SECTION_BY_PATHNAME.find(({ prefix }) => pathname.startsWith(prefix));
  const section = match?.section ?? "profile";

  return {
    section,
    href: match?.prefix ?? "/profile",
  };
}

export function accountHref(section: AccountSection): string {
  return SECTION_BY_PATHNAME.find((entry) => entry.section === section)?.prefix ?? "/profile";
}
