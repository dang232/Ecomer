import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(feDir, "..");

async function workflow(name) {
  return readFile(path.join(rootDir, ".github", "workflows", name), "utf8");
}

async function script(name) {
  return readFile(path.join(feDir, "scripts", name), "utf8");
}

test("CD builds source-labeled images and verifies OCI provenance bundles", async () => {
  const cd = await workflow("cd.yml");

  assert.match(
    cd,
    /labels:\s*org\.opencontainers\.image\.revision=\$\{\{ needs\.prepare\.outputs\.source_commit \}\}/,
  );
  assert.match(cd, /create-storage-record:\s*false/);
  assert.match(cd, /gh attestation verify[\s\S]*--bundle-from-oci/);
});

test("promotion uses a unique dispatch identity and gates the locked frontend image", async () => {
  const promote = await workflow("promote.yml");

  assert.match(
    promote,
    /dispatch_token:\s*\n\s+description:[^\n]*\n\s+required:\s*true/,
  );
  assert.match(promote, /run-name:[^\n]*inputs\.staging_revision/);
  assert.doesNotMatch(promote, /run-name:[^\n]*inputs\.dispatch_token/);
  assert.match(promote, /timeout-minutes:\s*90/);
  assert.match(promote, /^permissions:\r?\n  contents: read\r?\n  packages: read$/m);
  assert.match(promote, /uses:\s*docker\/login-action@[\w]+[\s\S]*?registry:\s*ghcr\.io/);
  assert.match(promote, /username:\s*\$\{\{ github\.actor \}\}/);
  assert.match(promote, /password:\s*\$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.match(promote, /select\(\.id == "frontend"\)/);
  assert.match(promote, /docker pull "\$FRONTEND_IMAGE"/);
  assert.match(
    promote,
    /gh attestation verify "oci:\/\/\$FRONTEND_IMAGE"[\s\S]*--bundle-from-oci/,
  );
  assert.match(
    promote,
    /\$params\s*=\s*@\([\s\S]*"-ImageReference"[\s\S]*"-ExpectedSourceCommit"[\s\S]*\)[\s\S]*run-cutover-gate\.ps1"\s*@params/,
  );
  assert.match(promote, /E2E_SELLER_USERNAME:\s*\$\{\{ secrets\.E2E_SELLER_USERNAME \}\}/);
  assert.match(promote, /E2E_ADMIN_USERNAME:\s*\$\{\{ secrets\.E2E_ADMIN_USERNAME \}\}/);
  assert.match(promote, /performance\/current/);
});

test("production reconciliation names manual and automatic verification runs", async () => {
  const verifyProduction = await workflow("verify-production.yml");

  assert.match(
    verifyProduction,
    /dispatch_token:\s*\n\s+description:[^\n]*\n\s+required:\s*false/,
  );
  assert.match(verifyProduction, /run-name:[^\n]*production_revision/);
  assert.match(verifyProduction, /run-name:[^\n]*automatic/);
  assert.doesNotMatch(verifyProduction, /run-name:[^\n]*dispatch_token/);
});
