#!/usr/bin/env node

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ZERO_DIGEST = `sha256:${'0'.repeat(64)}`;
const IMAGE_RE = /^- name: (ghcr\.io\/dang232\/vnshop-[^\n]+)\n  newName: ([^\n]+)\n  digest: (sha256:[0-9a-f]{64})$/gm;

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function parseImages(source) {
  return [...source.matchAll(IMAGE_RE)].map((match) => ({
    name: match[1],
    newName: match[2],
    digest: match[3],
  }));
}

async function registryDigest(image, expected) {
  try {
    const { stdout } = await exec('crane', ['digest', `${image}@${expected}`]);
    if (stdout.trim() !== expected) throw new Error(`resolved ${stdout.trim()}, expected ${expected}`);
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error('crane is required for registry verification');
    throw new Error(`${image}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  const overlay = resolve(argument('--overlay', 'infra/k8s/overlays/prod'));
  const fixture = argument('--fixture', '');
  const manifestPath = join(overlay, 'kustomization.yaml');
  const source = await readFile(manifestPath, 'utf8');
  const images = parseImages(source);

  if (images.length !== 19) throw new Error(`expected 19 GHCR images, found ${images.length}`);
  for (const image of images) {
    if (image.name !== image.newName) throw new Error(`image rename is not immutable: ${image.name}`);
    if (image.digest === ZERO_DIGEST) throw new Error(`placeholder digest: ${image.name}`);
    if (!/^sha256:[0-9a-f]{64}$/.test(image.digest)) throw new Error(`invalid digest: ${image.name}`);
  }

  if (fixture === 'all-zero') {
    const temp = await mkdtemp(join(ROOT, '.image-promotion-'));
    try {
      const fixturePath = join(temp, basename(manifestPath));
      await writeFile(fixturePath, source.replaceAll(/sha256:[0-9a-f]{64}/g, ZERO_DIGEST));
      const fixtureImages = parseImages(await readFile(fixturePath, 'utf8'));
      if (!fixtureImages.some(({ digest }) => digest === ZERO_DIGEST)) throw new Error('fixture was not mutated');
      throw new Error('all-zero fixture rejected as expected');
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }

  if (process.env.SKIP_CRANE !== 'true') {
    for (const image of images) await registryDigest(image.newName, image.digest);
  }
  console.log(`verified ${images.length} immutable GHCR images in ${manifestPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
