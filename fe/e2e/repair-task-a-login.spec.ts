import { expect, test } from "@playwright/test";

import { credentialForPersona, type Persona } from "./modernization/_credentials";

const apiURL = (process.env.VITE_E2E_API_URL ?? "http://localhost:8080").replace(/\/$/, "");
const SEEDED_PERSONAS = ["seller", "admin"] as const satisfies readonly Persona[];

interface LoginEnvelope {
  data?: {
    accessToken?: string;
  };
}

function parseLoginBody(raw: string): LoginEnvelope {
  try {
    return JSON.parse(raw) as LoginEnvelope;
  } catch {
    return {};
  }
}

test.describe.serial("Repair Task A seeded gateway login", () => {
  test("seller1 and admin1 can password-login without TOTP enrollment", async ({ playwright }) => {
    for (const persona of SEEDED_PERSONAS) {
      const request = await playwright.request.newContext();
      try {
        const credentials = credentialForPersona(persona);
        const response = await request.post(`${apiURL}/auth/login`, {
          data: credentials,
          failOnStatusCode: false,
        });
        const raw = await response.text();
        const body = parseLoginBody(raw);

        expect(response.status(), `${persona} login response: ${raw}`).toBe(200);
        expect(body.data?.accessToken, `${persona} login should return an access token`).toEqual(
          expect.any(String),
        );
        expect(body.data?.accessToken?.length ?? 0).toBeGreaterThan(0);
      } finally {
        await request.dispose();
      }
    }
  });
});
