import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const services = ["product-service"];

test("the dedicated product coverage lane has active 90% line and branch gates", async () => {
  for (const service of services) {
    const pom = await readFile(`services/${service}/pom.xml`, "utf8");
    assert.match(pom, /<artifactId>jacoco-maven-plugin<\/artifactId>/, service);
    assert.match(pom, /<counter>LINE<\/counter>/, service);
    assert.match(pom, /<counter>BRANCH<\/counter>/, service);
    assert.equal((pom.match(/<minimum>0\.90<\/minimum>/g) ?? []).length >= 2, true, service);
    assert.doesNotMatch(pom, /<skip>true<\/skip>/, service);
  }
});

test("coverage workflow is independent from fast CI and uploads reports", async () => {
  const workflow = await readFile(".github/workflows/ci-coverage.yml", "utf8");
  assert.match(workflow, /name: VNShop Java Coverage/);
  assert.match(workflow, /-Djacoco\.skip=false/);
  assert.match(workflow, /set -euo pipefail/);
  assert.match(workflow, /target\/site\/jacoco\//);
  assert.match(workflow, /needs: validate_configuration/);
  assert.match(workflow, /- product-service/);
  assert.doesNotMatch(workflow, /- coupon-service/);
});
