import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_CLASSES = new Set(["A", "R", "E", "T"]);
const RUNTIMES = new Set(["nginx", "node", "python", "spring"]);
const REQUIRED_FIELDS = ["id", "source", "image", "workload", "container", "runtime", "owner"];

function collectDockerfileSources(repoRoot) {
  const sources = [];

  if (existsSync(join(repoRoot, "fe", "Dockerfile"))) {
    sources.push("fe");
  }

  const servicesRoot = join(repoRoot, "services");
  if (existsSync(servicesRoot)) {
    for (const entry of readdirSync(servicesRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(servicesRoot, entry.name, "Dockerfile"))) {
        sources.push(`services/${entry.name}`);
      }
    }
  }

  return sources.sort();
}
function checkUnique(entries, field, errors) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry[field])) {
      errors.push(`duplicate ${field}: ${entry[field]}`);
    }
    seen.add(entry[field]);
  }
}

export function validateCatalog(catalog, repoRoot) {
  const errors = [];
  const deployables = Array.isArray(catalog.deployables) ? catalog.deployables : [];
  const retiredSources = new Set(catalog.retiredSources ?? []);

  if (!/^1\./.test(catalog.schemaVersion ?? "")) {
    errors.push("schemaVersion must use supported major version 1");
  }
  if (!Number.isInteger(catalog.expectedCount) || catalog.expectedCount < 1) {
    errors.push("expectedCount must be a positive integer");
  }
  if (deployables.length !== catalog.expectedCount) {
    errors.push(`expected ${catalog.expectedCount} deployables, found ${deployables.length}`);
  }
  if (catalog.expectedCount !== 19) {
    errors.push(`production catalog must contain exactly 19 deployables, found expectedCount=${catalog.expectedCount}`);
  }
  if (typeof catalog.imagePrefix !== "string" || !catalog.imagePrefix.endsWith("-")) {
    errors.push("imagePrefix must be a repository prefix ending in '-'");
  }

  for (const entry of deployables) {
    for (const field of REQUIRED_FIELDS) {
      if (typeof entry[field] !== "string" || entry[field].length === 0) {
        errors.push(`${entry.id ?? "<unknown>"}: ${field} is required`);
      }
    }
    if (!entry.image?.startsWith(catalog.imagePrefix ?? "<invalid>")) {
      errors.push(`${entry.id}: image must start with ${catalog.imagePrefix}`);
    }
    if (entry.image?.includes(":" ) || entry.image?.includes("@")) {
      errors.push(`${entry.id}: catalog image must be an immutable-lock repository without a tag or digest`);
    }
    if (!RUNTIMES.has(entry.runtime)) {
      errors.push(`${entry.id}: unsupported runtime ${entry.runtime}`);
    }
    if (!entry.probe || !entry.probe.readiness?.startsWith("/") || !entry.probe.liveness?.startsWith("/")) {
      errors.push(`${entry.id}: readiness and liveness probe paths are required`);
    }
    if (entry.runtime === "spring" && (entry.probe?.readiness !== "/actuator/health/readiness" || entry.probe?.liveness !== "/actuator/health/liveness")) {
      errors.push(`${entry.id}: Spring workloads must use actuator readiness and liveness probes`);
    }
    if (!Array.isArray(entry.data)) {
      errors.push(`${entry.id}: data must be an array`);
    } else {
      for (const dependency of entry.data) {
        if (typeof dependency.name !== "string" || !DATA_CLASSES.has(dependency.class)) {
          errors.push(`${entry.id}: data entries require a name and class A, R, E, or T`);
        }
      }
    }
    if (retiredSources.has(entry.source) || /(?:coupon|review)-service/.test(entry.source)) {
      errors.push(`${entry.id}: retired service cannot be deployable (${entry.source})`);
    }
    if (!existsSync(join(repoRoot, entry.source, "Dockerfile"))) {
      errors.push(`${entry.id}: missing Dockerfile at ${entry.source}/Dockerfile`);
    }
  }

  for (const field of ["id", "source", "image", "workload", "container"]) {
    checkUnique(deployables, field, errors);
  }

  const catalogSources = new Set(deployables.map((entry) => entry.source));
  for (const source of collectDockerfileSources(repoRoot)) {
    if (!catalogSources.has(source) && !retiredSources.has(source)) {
      errors.push(`unclassified Dockerfile source: ${source}`);
    }
  }

  return errors;
}

export function loadAndValidate(catalogPath) {
  const absoluteCatalogPath = resolve(catalogPath);
  const catalog = JSON.parse(readFileSync(absoluteCatalogPath, "utf8"));
  const repoRoot = resolve(dirname(absoluteCatalogPath), "..");
  return validateCatalog(catalog, repoRoot);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  const catalogPath = process.argv[2] ?? join(dirname(currentFile), "..", "deployables.json");
  const errors = loadAndValidate(catalogPath);

  if (errors.length > 0) {
    console.error("Deployable catalog validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    const displayPath = relative(process.cwd(), resolve(catalogPath)) || catalogPath;
    console.log(`Deployable catalog is valid: ${displayPath} (19 artifacts)`);
  }
}
