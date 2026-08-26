#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const canonicalPath = path.join(root, "infra", "kafka", "canonical-topics.json");
const sourceRootFlag = process.argv.indexOf("--source-root");
const sourceRoot = path.resolve(sourceRootFlag >= 0 ? process.argv[sourceRootFlag + 1] : path.join(root, "services"));
const canonical = JSON.parse(await readFile(canonicalPath, "utf8"));
const topics = new Set(canonical.topics);
const principals = canonical.clients ?? {};
const aclRows = canonical.acl ?? [];
const topicMatches = (pattern, topic) => pattern.endsWith(".*") ? topic.startsWith(pattern.slice(0, -1)) : pattern === topic;
const allowed = new Set();
for (const row of aclRows) {
  const principal = principals[row.service];
  for (const operation of ["read", "write"]) {
    for (const pattern of row[operation] ?? []) {
      for (const topic of topics) {
        if (topicMatches(pattern, topic)) allowed.add(`${principal}|${operation}|${topic}`);
      }
    }
  }
}

const ignored = /(^|[\\/])(node_modules|target|dist|build|coverage|\.git|test|tests|__tests__)([\\/]|$)/;
const extensions = new Set([".java", ".ts", ".py"]);
const usages = [];

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    const relative = path.relative(sourceRoot, filename);
    if (ignored.test(relative)) continue;
    if (entry.isDirectory()) result.push(...await files(filename));
    else if (extensions.has(path.extname(entry.name))) result.push(filename);
  }
  return result;
}

function add(file, service, line, topic, operation) {
  if (topic && /^[a-z0-9][a-zA-Z0-9.-]*$/.test(topic)) usages.push({ file, service, line, topic, operation });
}

for (const file of await files(sourceRoot)) {
  const text = await readFile(file, "utf8");
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  const sourceRelative = path.relative(sourceRoot, file).replaceAll(path.sep, "/");
  const service = relative.match(/^services\/([^/]+)\//)?.[1] ?? sourceRelative.split("/")[0];
  const principal = principals[service];
  if (!principal) continue;
  const constantNames = new Map();
  for (const match of text.matchAll(/\b([A-Z][A-Z0-9_]*(?:TOPIC|D_TOPIC|_TOPIC)[A-Z0-9_]*)\s*=\s*["']([a-z0-9][a-zA-Z0-9.-]*)["']/g)) constantNames.set(match[1], match[2]);
  for (const match of text.matchAll(/@KafkaListener\s*\(([\s\S]*?)\)/g)) {
    const annotation = match[1];
    const topicsArgument = annotation.match(/\btopics\s*=\s*(\{[^}]*\}|[^,]+)/);
    if (topicsArgument) {
      const topicExpression = topicsArgument[1];
      for (const literal of topicExpression.matchAll(/["']([a-z0-9][a-zA-Z0-9.-]*)["']/g)) add(relative, service, text.slice(0, match.index).split("\n").length, literal[1], "read");
      for (const name of topicExpression.matchAll(/\b([A-Z][A-Z0-9_]*(?:TOPIC|D_TOPIC|_TOPIC)*)\b/g)) add(relative, service, text.slice(0, match.index).split("\n").length, constantNames.get(name[1]), "read");
    }
  }
  for (const match of text.matchAll(/@MessagePattern\s*\(\s*["']([a-z0-9][a-z0-9.-]*)["']/g)) add(relative, service, text.slice(0, match.index).split("\n").length, match[1], "read");
  for (const match of text.matchAll(/(?:kafkaTemplate|kafka|producer|_producer)\.send\s*\(\s*["']([a-z0-9][a-z0-9.-]*)["']/g)) add(relative, service, text.slice(0, match.index).split("\n").length, match[1], "write");
  for (const match of text.matchAll(/new\s+ProducerRecord\s*<[^>]*>\s*\(\s*["']([a-z0-9][a-z0-9.-]*)["']/g)) add(relative, service, text.slice(0, match.index).split("\n").length, match[1], "write");
  for (const match of text.matchAll(/\b([A-Z][A-Z0-9_]*(?:TOPIC|D_TOPIC|_TOPIC)[A-Z0-9_]*)\s*=\s*["']([a-z0-9][a-zA-Z0-9.-]*)["']/g)) {
    if (text.includes(`send(${match[1]}`) || text.includes(`send(\n            ${match[1]}`) || text.includes(`send(\n                    ${match[1]}`)) add(relative, service, text.slice(0, match.index).split("\n").length, match[2], "write");
  }
  for (const match of text.matchAll(/kafka_topic_([a-z0-9_]+)\s*:\s*str\s*=\s*["']([a-z0-9][a-zA-Z0-9.-]*)["']/gi)) add(relative, service, text.slice(0, match.index).split("\n").length, match[2], match[1].includes("consume") ? "read" : "write");
}

const errors = [];
for (const usage of usages) {
  if (!topics.has(usage.topic)) errors.push(`${usage.file}:${usage.line}: missing canonical topic ${usage.topic}`);
  else if (!allowed.has(`${principals[usage.service]}|${usage.operation}|${usage.topic}`)) errors.push(`${usage.file}:${usage.line}: missing ${usage.operation} ACL for ${usage.topic}`);
}
const uniqueErrors = [...new Set(errors)].sort();
if (uniqueErrors.length > 0) {
  console.error(uniqueErrors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Kafka usage scan passed (${new Set(usages.map((usage) => usage.topic)).size} topics, ${usages.length} references).`);
}
