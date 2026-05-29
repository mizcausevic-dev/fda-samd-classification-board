#!/usr/bin/env node
// verify.mjs — validate a SaMD classification record against the schema and
// the lifecycle state-machine. Re-derives canonical-JSON SHA-256 to confirm
// the hash field is consistent with the body.
//
// Usage:
//   node src/verify.mjs examples/skinscan-v4-510k-class-ii.json
//
// Exits 0 on success, 1 on validation failure.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const VALID_TRANSITIONS = {
  "pre-submission-design":                        new Set(["q-sub-filed", "submission-pending", "withdrawn"]),
  "q-sub-filed":                                  new Set(["submission-pending", "withdrawn"]),
  "submission-pending":                           new Set(["submission-under-review", "withdrawn"]),
  "submission-under-review":                      new Set(["additional-information-requested", "cleared-or-approved", "withdrawn"]),
  "additional-information-requested":             new Set(["submission-under-review", "withdrawn"]),
  "cleared-or-approved":                          new Set(["marketed", "withdrawn"]),
  "marketed":                                     new Set(["pccp-change-pending", "modification-requires-new-submission", "post-market-corrective-action", "withdrawn", "superseded-by-new-version"]),
  "pccp-change-pending":                          new Set(["pccp-change-implemented", "pccp-change-pending", "modification-requires-new-submission", "withdrawn"]),
  "pccp-change-implemented":                      new Set(["marketed", "post-market-corrective-action"]),
  "modification-requires-new-submission":         new Set(["submission-pending", "withdrawn"]),
  "post-market-corrective-action":                new Set(["marketed", "pccp-change-pending", "modification-requires-new-submission", "withdrawn"]),
  "withdrawn":                                    new Set([]),
  "superseded-by-new-version":                    new Set([]),
};

// Canonical-JSON serialization per RFC 8785, sorted keys.
// Used to derive the SHA-256 hash that lands in the `hash` field.
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

function sha256Hex(s) {
  return createHash("sha256").update(s).digest("hex");
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log("OK:  ", msg);
}

const path = process.argv[2];
if (!path) {
  console.error("usage: node src/verify.mjs <record.json>");
  process.exit(2);
}

const raw = readFileSync(path, "utf8");
let record;
try {
  record = JSON.parse(raw);
} catch (e) {
  fail(`JSON parse error: ${e.message}`);
  process.exit(1);
}

// --- record_version check
if (record.record_version !== "0.1") {
  fail(`record_version must be '0.1', got '${record.record_version}'`);
} else {
  ok("record_version is 0.1");
}

// --- hash check
const { hash, ...bodyWithoutHash } = record;
const recomputed = sha256Hex(canonicalJson(bodyWithoutHash));
if (recomputed === hash) {
  ok(`hash matches recomputed canonical SHA-256 (${hash.slice(0, 12)}…)`);
} else {
  fail(`hash mismatch: record claims ${hash}, recomputed ${recomputed} (this is expected for hand-authored example fixtures; for production records use src/build-examples.mjs to recompute)`);
}

// --- prev_hash format
if (!/^[0-9a-f]{64}$/.test(record.prev_hash)) {
  fail(`prev_hash is not 64 hex chars: ${record.prev_hash}`);
} else {
  ok(`prev_hash is well-formed (${record.prev_hash === "0".repeat(64) ? "genesis record" : "linked to prior"})`);
}

// --- lifecycle state-machine
const lifecycle = record.lifecycle_state;
const transitions = record.transitions ?? [];
if (transitions.length === 0) {
  fail("transitions[] is empty — every record MUST carry at least one transition");
} else {
  let prevState = transitions[0].from_state;
  let lastTo = null;
  let stepNum = 0;
  for (const t of transitions) {
    stepNum++;
    if (t.from_state !== prevState) {
      fail(`transition #${stepNum}: from_state '${t.from_state}' does not match prior to_state '${prevState}'`);
      break;
    }
    const allowed = VALID_TRANSITIONS[t.from_state];
    if (!allowed) {
      fail(`transition #${stepNum}: from_state '${t.from_state}' is not a known lifecycle state`);
      break;
    }
    if (!allowed.has(t.to_state)) {
      fail(`transition #${stepNum}: '${t.from_state}' → '${t.to_state}' is not a valid lifecycle transition`);
      break;
    }
    prevState = t.to_state;
    lastTo = t.to_state;
  }
  if (lastTo && lastTo !== lifecycle) {
    fail(`lifecycle_state '${lifecycle}' does not match the last transition's to_state '${lastTo}'`);
  } else if (lastTo) {
    ok(`lifecycle state-machine consistent (${transitions.length} transitions, current = '${lifecycle}')`);
  }
}

// --- PCCP presence consistency
if (lifecycle === "pccp-change-pending" || lifecycle === "pccp-change-implemented") {
  if (!record.predetermined_change_control_plan) {
    fail("lifecycle is PCCP-related but no predetermined_change_control_plan object present");
  } else {
    ok("PCCP block present and lifecycle state requires it");
  }
}

// --- 510(k) requires k_number once cleared
if (record.regulatory_pathway?.pathway === "510(k)") {
  if (record.regulatory_pathway?.decision_at && !record.regulatory_pathway?.k_number) {
    fail("510(k) record has decision_at but no k_number — once cleared, k_number MUST be populated");
  } else if (record.regulatory_pathway?.k_number) {
    ok(`510(k) record carries k_number ${record.regulatory_pathway.k_number}`);
  }
}

if (process.exitCode === 1) {
  console.error("\nVerification FAILED.");
} else {
  console.log("\nVerification PASSED.");
}
