#!/usr/bin/env node
// build-examples.mjs — recompute canonical-JSON SHA-256 hashes for every
// example in examples/, write them back. Run after editing any example
// JSON to refresh the `hash` field so verify.mjs passes.
//
// Usage:
//   node src/build-examples.mjs

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

function sha256Hex(s) {
  return createHash("sha256").update(s).digest("hex");
}

const dir = "examples";
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

for (const f of files) {
  const path = join(dir, f);
  const record = JSON.parse(readFileSync(path, "utf8"));
  const { hash, ...bodyWithoutHash } = record;
  const newHash = sha256Hex(canonicalJson(bodyWithoutHash));
  record.hash = newHash;
  writeFileSync(path, JSON.stringify(record, null, 2) + "\n");
  console.log(`  ${f}  hash → ${newHash.slice(0, 12)}…`);
}

console.log(`\nRewrote hashes for ${files.length} example(s).`);
