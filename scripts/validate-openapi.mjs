#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const input = process.argv[2] ?? process.env.OPENAPI_FILE ?? process.env.OPENAPI_URL;
if (!input) {
  console.error('Usage: node scripts/validate-openapi.mjs <file-or-url|->');
  process.exit(2);
}

let raw;
if (input === '-') {
  raw = '';
  for await (const chunk of process.stdin) raw += chunk;
} else if (input.startsWith('http://') || input.startsWith('https://')) {
  raw = await (await fetch(input)).text();
} else {
  raw = await readFile(input, 'utf8');
}
const document = JSON.parse(raw);
const errors = [];

if (document.openapi !== '3.1.0') errors.push('document must use OpenAPI 3.1.0');
if (!document.info || typeof document.info.title !== 'string') errors.push('document.info.title is required');
if (!Array.isArray(document.servers) || document.servers.length !== 1) errors.push('document must have exactly one gateway server');
if (document.servers?.some((server) => typeof server.url !== 'string' || /(?:-service|keycloak|postgres|redis)/i.test(server.url))) {
  errors.push('document.servers must not expose internal service URLs');
}
if (!document.paths || typeof document.paths !== 'object' || Array.isArray(document.paths)) errors.push('document.paths is required');

const operations = [];
const operationIds = new Set();
const serviceOperationCounts = new Map();
const localRefs = [];
const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

const walk = (value) => {
  if (Array.isArray(value)) return value.forEach(walk);
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (key === '$ref' && typeof entry === 'string' && entry.startsWith('#/')) localRefs.push(entry);
    walk(entry);
  }
};

for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
  if (!pathItem || typeof pathItem !== 'object') continue;
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!methods.has(method) || !operation || typeof operation !== 'object') continue;
    operations.push([path, method, operation]);
    if (typeof operation.operationId !== 'string' || operation.operationId.length === 0) {
      errors.push(`${method.toUpperCase()} ${path} has no operationId`);
    } else if (operationIds.has(operation.operationId)) {
      errors.push(`duplicate operationId: ${operation.operationId}`);
    } else {
      operationIds.add(operation.operationId);
    }
    const serviceId = operation['x-vnshop-service'];
    if (typeof serviceId !== 'string') errors.push(`${method.toUpperCase()} ${path} has no x-vnshop-service`);
    else serviceOperationCounts.set(serviceId, (serviceOperationCounts.get(serviceId) ?? 0) + 1);
  }
}
walk(document);

const resolvePointer = (pointer) => pointer.slice(2).split('/').map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~')).reduce((current, key) => current?.[key], document);
for (const reference of localRefs) {
  if (resolvePointer(reference) === undefined) errors.push(`unresolved local reference: ${reference}`);
}

for (const status of document['x-vnshop-service-status'] ?? []) {
  if (['healthy', 'stale'].includes(status.status) && !serviceOperationCounts.has(status.serviceId)) {
    errors.push(`enabled service has no documented operations: ${status.serviceId}`);
  }
}

if (errors.length > 0) {
  console.error(`OpenAPI validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`OpenAPI valid: ${operations.length} operations, ${operationIds.size} unique operation IDs`);
