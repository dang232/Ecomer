#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (!argument.startsWith('--')) continue;
  args.set(argument, process.argv[index + 1] ?? '');
  index += 1;
}

function assertContains(text, pattern, message) {
  if (!pattern.test(text)) throw new Error(message);
}

function assertGroup(manifest, name, policy) {
  const resources = manifest.replaceAll('\r', '').split('---');
  const statefulSet = resources.find(
    (resource) => resource.includes('kind: StatefulSet') && resource.split('\n').some((line) => line.trim() === `name: ${name}`),
  );
  const sentinelSet = resources.find(
    (resource) => resource.includes('kind: StatefulSet') && resource.split('\n').some((line) => line.trim() === `name: ${name}-sentinel`),
  );
  assertContains(statefulSet ?? '', /serviceName:/, `${name} must define a headless service`);
  assertContains(statefulSet ?? '', /replicas: 3/, `${name} must be a three-replica StatefulSet`);
  assertContains(sentinelSet ?? '', /replicas: 3/, `${name} needs three Sentinel replicas`);
  assertContains(manifest, new RegExp(`vnshop.io/redis-policy: ${policy}`), `${name} must use ${policy}`);
}

function validate(manifest, workloads = '') {
  assertContains(manifest, /kind: postgresql/, 'PostgreSQL operator resource is missing');
  assertContains(manifest, /numberOfInstances: 3/, 'PostgreSQL must have three operator instances');
  assertContains(manifest, /synchronous_standby_names:/, 'PostgreSQL synchronous replication is missing');
  assertContains(manifest, /kind: StatefulSet[\s\S]*?name: redis-rate-limit(?:\s|,)/, 'rate-limit Redis group is missing');
  assertGroup(manifest, 'redis-rate-limit', 'noeviction');
  assertGroup(manifest, 'redis-cart', 'volatile-lru');
  assertGroup(manifest, 'redis-dedup', 'volatile-ttl');
  if (/REDIS_DB/.test(manifest)) {
    throw new Error('Redis must not configure eviction per logical database');
  }
  assertContains(manifest, /name: mongodb[\s\S]*?replicas: 3/, 'MongoDB must have three replicas');
  assertContains(manifest, /--replSet, rs0/, 'MongoDB replica-set mode is missing');
  assertContains(manifest, /name: minio[\s\S]*?replicas: 4/, 'MinIO must have four server replicas');
  assertContains(manifest, /erasure-coding: "4\+2"/, 'MinIO 4+2 erasure coding contract is missing');
  assertContains(manifest, /http:\/\/minio-\{0\.\.\.3\}\.minio-headless\/data\{1\.\.\.2\}/, 'MinIO must address four pods and two drives');
  assertContains(manifest, /name: keycloak[\s\S]*?replicas: 2/, 'Keycloak must have two replicas');
  if (workloads) {
    assertContains(workloads, /name: REDIS_SENTINEL_MASTER[\s\S]*?REDIS_CART_SENTINEL_MASTER/, 'cart must use the cart Sentinel group');
    assertContains(workloads, /name: REDIS_SENTINEL_MASTER[\s\S]*?REDIS_DEDUP_SENTINEL_MASTER/, 'notification must use the dedup Sentinel group');
  }
}

const manifestPath = args.get('--manifest') || 'infra/k8s/base/platform-services.yaml';
const workloadsPath = args.get('--workloads') || 'infra/k8s/base/workloads.yaml';
try {
  const workloads = args.has('--workloads') ? await readFile(workloadsPath, 'utf8') : '';
  validate(await readFile(manifestPath, 'utf8'), workloads);
  console.log(`HA contract valid: ${manifestPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

export { validate };
