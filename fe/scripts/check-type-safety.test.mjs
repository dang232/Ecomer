import assert from "node:assert/strict";
import test from "node:test";

import { findUnsafeLines } from "./check-type-safety.mjs";

test("findUnsafeLines rejects type escapes and permits ordinary assertions", () => {
  assert.deepEqual(
    findUnsafeLines(
      `const x = value as any;
// @ts-ignore
const parseJson = JSON.parse;
const y = parseJson(
  raw,
) as Value;
const z = (
  await response.json()
) as Value;
const readResponse = response.json.bind(response);
const w = (await readResponse()) as Value;
`,
    ),
    [
      { line: 1, pattern: "as any" },
      { line: 2, pattern: "@ts-ignore" },
      { line: 4, pattern: "JSON.parse assertion" },
      { line: 7, pattern: "response.json assertion" },
      { line: 11, pattern: "response.json assertion" },
    ],
  );
  assert.deepEqual(findUnsafeLines("const x = value as HTMLInputElement;\n"), []);
});

test("tracks assertion-only trust through parsed-value aliases", () => {
  const findings = findUnsafeLines(`
    const parsed = JSON.parse(raw);
    const aliased = parsed;
    const domain = aliased as Domain;
    const responsePayload = await response.json();
    const responseDomain = responsePayload as Domain;
  `);
  assert.deepEqual(
    findings.map(({ pattern }) => pattern),
    ["JSON.parse assertion", "response.json assertion"],
  );
});

test("rejects non-null assertions in production code", () => {
  assert.deepEqual(findUnsafeLines("const seller = sellerId!;\n"), [
    { line: 1, pattern: "non-null assertion" },
  ]);
});

test("rejects nocheck, every lint suppression, and computed or destructured boundaries", () => {
  const findings = findUnsafeLines(`
    // @ts-nocheck
    // eslint-disable
    /* eslint
       @typescript-eslint/no-unsafe-assignment: "off"
    */
    /* eslint @typescript-eslint/no-unsafe-return: ["off", { allow: [] }] */
    const parse = JSON[\`parse\`];
    const computed = parse(raw) as Domain;
    const { parse: destructured } = JSON;
    const value = destructured(raw) as Domain;
    const read = response["json"]["bind"](response);
    const payload = (await read()) as Domain;
    const { json: destructuredRead } = response;
    const destructuredPayload = (await destructuredRead.call(response)) as Domain;
  `);
  assert.deepEqual(
    findings.map(({ pattern }) => pattern),
    [
      "@ts-nocheck",
      "lint suppression",
      "lint suppression",
      "lint suppression",
      "JSON.parse assertion",
      "JSON.parse assertion",
      "response.json assertion",
      "response.json assertion",
    ],
  );
});

test("finds a JSX trailing lint suppression comment", () => {
  assert.deepEqual(
    findUnsafeLines(
      `const view = <section>ready</section>;
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const payload = source;
`,
      "fixture.tsx",
    ),
    [{ line: 2, pattern: "lint suppression" }],
  );
});
