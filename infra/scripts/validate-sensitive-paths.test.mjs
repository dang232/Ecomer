import assert from "node:assert/strict";
import test from "node:test";

import { validateTrackedFiles } from "./validate-sensitive-paths.mjs";

test("accepts environment examples and ordinary tracked files", () => {
  const errors = validateTrackedFiles(
    [".env.example", "services/cart-service/.env.example", "README.md"],
    () => "documented placeholder"
  );

  assert.deepEqual(errors, []);
});

test("rejects known leaked paths and non-example environment files", () => {
  const errors = validateTrackedFiles(
    [".env.dokploy", "infra/kafka/certs/ssl_credentials", "services/cart-service/.env.production"],
    () => ""
  );

  assert.ok(errors.some((error) => error.includes(".env.dokploy")));
  assert.ok(errors.some((error) => error.includes("ssl_credentials")));
  assert.ok(errors.some((error) => error.includes(".env.production")));
});

test("rejects private-key filenames and content markers", () => {
  const privateKeyMarker = ["-----BEGIN OPENSSH", "PRIVATE KEY-----"].join(" ");
  const files = new Map([
    ["operator-private-key.txt", "redacted"],
    ["deploy/id_rsa", "redacted"],
    ["certs/server.key", "redacted"],
    ["notes.txt", `${privateKeyMarker}\nredacted`]
  ]);
  const errors = validateTrackedFiles([...files.keys()], (path) => files.get(path));

  assert.ok(errors.some((error) => error.includes("private-key filename")));
  assert.ok(errors.some((error) => error.includes("deploy/id_rsa")));
  assert.ok(errors.some((error) => error.includes("certs/server.key")));
  assert.ok(errors.some((error) => error.includes("private-key material")));
});
