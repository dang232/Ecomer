import { describe, expect, it } from "vitest";
import { z } from "zod";

import { readJson, readJsonText } from "./read-json";

describe("readJson", () => {
  it("returns schema-decoded data", async () => {
    const response = new Response(JSON.stringify({ status: "UP" }));

    await expect(readJson(response, z.object({ status: z.literal("UP") }))).resolves.toEqual({ status: "UP" });
  });

  it("rejects malformed payloads", async () => {
    const response = new Response(JSON.stringify({ status: 12 }));

    await expect(readJson(response, z.object({ status: z.string() }))).rejects.toThrow();
  });

  it("parses text JSON as unknown before schema validation", () => {
    expect(readJsonText('{"ok":true}', z.object({ ok: z.boolean() }))).toEqual({ ok: true });
    expect(() => readJsonText('{"ok":"yes"}', z.object({ ok: z.boolean() }))).toThrow();
  });
});
