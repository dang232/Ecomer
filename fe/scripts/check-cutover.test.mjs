import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const feDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(target);
        return /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
      }),
    )
  ).flat();
}

test("production source has no modernization preview or compatibility generation", async () => {
  const files = await sourceFiles(path.join(feDir, "src"));
  const source = (
    await Promise.all(files.map((file) => readFile(file, "utf8")))
  ).join("\n");
  const packageJson = JSON.parse(await readFile(path.join(feDir, "package.json"), "utf8"));
  assert.doesNotMatch(
    source,
    /__commercePreview|commerce-preview|currentGeneration|@tabler\/icons-react|figma:asset/,
  );
  assert.doesNotMatch(source, /app\/components\/ui/);
  assert.equal(packageJson.dependencies["@figma/astraui"], undefined);
  assert.equal(packageJson.dependencies["@tabler/icons-react"], undefined);

  for (const removed of [
    "src/shared/routing/commerce-preview.ts",
    "src/app/components/ui/confirm-dialog.tsx",
    "src/app/pages/Root.tsx",
    "src/app/pages/seller/SellerPage.tsx",
    "src/app/pages/admin/AdminPage.tsx",
  ]) {
    await assert.rejects(readFile(path.join(feDir, removed), "utf8"));
  }
});