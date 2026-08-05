import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const realmPath = path.join(repoRoot, "infra/keycloak/vnshop-realm.json");
const bootstrapPath = path.join(repoRoot, "infra/scripts/setup-keycloak-admin-client.sh");

test("local seeded QA users do not force TOTP while the realm keeps MFA opt-in available", async () => {
  const realm = JSON.parse(await readFile(realmPath, "utf8"));
  const users = new Map(realm.users.map((user) => [user.username, user]));
  const requiredAction = realm.requiredActions.find((action) => action.alias === "CONFIGURE_TOTP");

  for (const username of ["seller1", "admin1"]) {
    assert.ok(users.has(username), `${username} seed is missing`);
    assert.ok(!users.get(username)?.requiredActions?.includes("CONFIGURE_TOTP"), username);
  }

  assert.equal(requiredAction?.enabled, true);
  assert.equal(requiredAction?.defaultAction, false);
});

test("the bootstrap documents both default local QA repair and explicit MFA opt-in", async () => {
  const script = await readFile(bootstrapPath, "utf8");

  assert.match(script, /KEYCLOAK_LOCAL_SEED_MFA_REQUIRED/);
  assert.match(script, /seller1/);
  assert.match(script, /admin1/);
  assert.match(script, /CONFIGURE_TOTP/);
  assert.match(script, /REQUIRED_ACTIONS='\[\]/);
  assert.match(script, /REQUIRED_ACTIONS='\["CONFIGURE_TOTP"\]'/);
  assert.match(script, /requiredActions=\$\{REQUIRED_ACTIONS\}/);
});

test("the bootstrap fails closed and selects exact seeded usernames", async () => {
  const script = await readFile(bootstrapPath, "utf8");

  assert.match(script, /--query "username=\$\{username\}"/);
  assert.match(script, /--query "exact=true"/);
  assert.match(script, /if ! user_json=\$\(/);
  assert.match(script, /return 1/);
  assert.doesNotMatch(script, /\|\| user_id=""/);
  assert.doesNotMatch(script, /--rolename view-realm 2>\/dev\/null \|\| true/);
});
