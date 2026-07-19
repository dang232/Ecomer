import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import catalog from "../deployables.json" with { type: "json" };
import { validateCatalog } from "./validate-deployables.mjs";

function createRepositoryFixture(sourceCatalog = catalog) {
  const root = mkdtempSync(join(tmpdir(), "vnshop-deployables-"));
  for (const entry of sourceCatalog.deployables) {
    const source = join(root, ...entry.source.split("/"));
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "Dockerfile"), "FROM scratch\n");
  }
  for (const sourceName of sourceCatalog.retiredSources) {
    const source = join(root, ...sourceName.split("/"));
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "Dockerfile"), "FROM scratch\n");
  }
  return root;
}

function cloneCatalog() {
  return structuredClone(catalog);
}

test("accepts the checked 19-artifact catalog", (t) => {
  const root = createRepositoryFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  assert.deepEqual(validateCatalog(catalog, root), []);
});

test("rejects duplicate and missing deployables", (t) => {
  const candidate = cloneCatalog();
  candidate.deployables[1].id = candidate.deployables[0].id;
  candidate.deployables.pop();
  const root = createRepositoryFixture(candidate);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const errors = validateCatalog(candidate, root);
  assert.ok(errors.some((error) => error.includes("expected 19 deployables")));
  assert.ok(errors.some((error) => error.includes("duplicate id")));
});

test("rejects mutable image references and retired services", (t) => {
  const candidate = cloneCatalog();
  candidate.deployables[0].image = "ghcr.io/dang232/vnshop-frontend:latest";
  candidate.deployables[1].source = "services/coupon-service";
  const root = createRepositoryFixture(candidate);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const errors = validateCatalog(candidate, root);
  assert.ok(errors.some((error) => error.includes("without a tag or digest")));
  assert.ok(errors.some((error) => error.includes("retired service cannot be deployable")));
});

test("rejects invalid probe and data contracts", (t) => {
  const candidate = cloneCatalog();
  candidate.deployables[1].probe.readiness = "/health";
  candidate.deployables[2].data[0].class = "unknown";
  const root = createRepositoryFixture(candidate);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const errors = validateCatalog(candidate, root);
  assert.ok(errors.some((error) => error.includes("Spring workloads must use actuator")));
  assert.ok(errors.some((error) => error.includes("class A, R, E, or T")));
});

test("rejects an unclassified buildable source", (t) => {
  const root = createRepositoryFixture();
  const unknown = join(root, "services", "unknown-service");
  mkdirSync(unknown, { recursive: true });
  writeFileSync(join(unknown, "Dockerfile"), "FROM scratch\n");
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const errors = validateCatalog(catalog, root);
  assert.ok(errors.some((error) => error.includes("unclassified Dockerfile source: services/unknown-service")));
});
