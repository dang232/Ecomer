/**
 * One source of truth for seeded persona credentials used by E2E.
 *
 * Contract mode (`E2E_RELEASE_CONTRACT=true`): credentials are required and
 * must be provided via environment variables.  This is the mode the protected
 * promotion workflow uses so that rotated protected secrets are never bypassed.
 *
 * Local / development mode (default): falls back to well-known seed values
 * so the suite remains runnable without environment setup.
 *
 * `E2E_REQUIRED_PERSONAS` is a comma-separated list of personas that MUST be
 * validated before the suite starts.  Consumers call `validateCredentials()`
 * during global setup to fail fast with a clear message rather than silently
 * skipping credential-bound tests.
 */

export type Persona = "buyer" | "seller" | "admin";

export interface PersonaCredential {
  username: string;
  password: string;
}
const PERSONAS = ["buyer", "seller", "admin"] as const satisfies readonly Persona[];

const LOCAL_FALLBACKS = {
  buyer: "buyer1",
  seller: "seller1",
  admin: "admin1",
} as const satisfies Record<Persona, string>;

const LOCAL_CREDENTIALS: Record<Persona, PersonaCredential> = {
  buyer: { username: LOCAL_FALLBACKS.buyer, password: "test" },
  seller: { username: LOCAL_FALLBACKS.seller, password: "test" },
  admin: { username: LOCAL_FALLBACKS.admin, password: "test" },
};

function isContractMode(): boolean {
  return process.env.E2E_RELEASE_CONTRACT === "true";
}

function envKey(persona: Persona, suffix: "USERNAME" | "PASSWORD"): string {
  return `E2E_${persona.toUpperCase()}_${suffix}`;
}

function parsePersona(input: string): Persona {
  if ((PERSONAS as readonly string[]).includes(input)) {
    return input as Persona;
  }
  throw new Error(
    `Invalid persona "${input}" in E2E_REQUIRED_PERSONAS. Expected one of: ${PERSONAS.join(", ")}`,
  );
}

function contractCredentialForPersona(persona: Persona): PersonaCredential {
  const username = process.env[envKey(persona, "USERNAME")];
  const password = process.env[envKey(persona, "PASSWORD")];
  if (username === undefined) {
    throw new Error(
      `E2E_RELEASE_CONTRACT=true: ${envKey(persona, "USERNAME")} is required but not set`,
    );
  }
  if (password === undefined) {
    throw new Error(
      `E2E_RELEASE_CONTRACT=true: ${envKey(persona, "PASSWORD")} is required but not set`,
    );
  }
  return { username, password };
}

export function credentialForPersona(persona: Persona): PersonaCredential {
  return isContractMode() ? contractCredentialForPersona(persona) : LOCAL_CREDENTIALS[persona];
}

/**
 * Returns the list of personas that must be validated before the suite starts.
 * Parses `E2E_REQUIRED_PERSONAS` when set (comma-separated); otherwise
 * returns all three personas for local runs.
 */
export function requiredPersonas(): Persona[] {
  const env = process.env.E2E_REQUIRED_PERSONAS?.trim();
  if (!env) {
    if (isContractMode()) {
      throw new Error(
        "E2E_RELEASE_CONTRACT=true requires E2E_REQUIRED_PERSONAS to declare at least one persona",
      );
    }
    return [...PERSONAS];
  }

  const unique = new Set<Persona>();
  for (const rawPersona of env.split(",")) {
    const persona = parsePersona(rawPersona.trim());
    unique.add(persona);
  }

  if (unique.size === 0) {
    if (isContractMode()) {
      throw new Error(
        "E2E_RELEASE_CONTRACT=true requires E2E_REQUIRED_PERSONAS to declare at least one persona",
      );
    }
    throw new Error("E2E_REQUIRED_PERSONAS must contain at least one persona when set");
  }

  return [...unique];
}

/**
 * Validate that credentials for every required persona are present and non-empty.
 * Throws with a clear message if any required persona is missing credentials.
 * Call this during Playwright global setup.
 */
export function validateCredentials(): void {
  for (const persona of requiredPersonas()) {
    const { username, password } = credentialForPersona(persona);
    if (!username.trim()) {
      throw new Error(`${envKey(persona, "USERNAME")} must be a non-empty string`);
    }
    if (!password.trim()) {
      throw new Error(`${envKey(persona, "PASSWORD")} must be a non-empty string`);
    }
  }
}

/**
 * Returns the default username for a persona (local fallback name only,
 * not the resolved credential). Useful for API setup payloads where the
 * username/email field is needed but no auth is involved.
 */
export function defaultUsername(persona: Persona): string {
  return process.env[envKey(persona, "USERNAME")] ?? LOCAL_FALLBACKS[persona];
}
