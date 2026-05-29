# Changelog

All notable changes to the FDA SaMD Classification Board.

## [0.1] — 2026-05-29

### Added

- Initial schema (`schema/samd-classification-record.schema.json`) with hash-chained record shape, FDA pathway enum, lifecycle state machine, and PCCP block per FDA's December 2024 final guidance.
- Reference verifier (`src/verify.mjs`) — re-derives canonical-JSON SHA-256, walks the state machine, enforces the PCCP-block-presence rule when lifecycle is PCCP-related, enforces the 510(k)-cleared-requires-k-number rule.
- Hash builder (`src/build-examples.mjs`) — recomputes hash fields across all examples after edits.
- Three worked examples:
  - **`skinscan-v4-510k-class-ii.json`** — clean 510(k) Class II lifecycle (Q-Sub → submission → AI/ML interactive review → cleared → marketed). Same K231234 device that appears across the rest of the HealthTech 6-pack.
  - **`skinscan-v4-3-pccp-trigger.json`** — post-market PCCP modification triggered by Fitzpatrick V + VI bias-coverage gap detected in the field, linked back to the `clinical-bias-cohort-coverage-lab` example bundle's gap event.
  - **`novel-genai-pathology-de-novo.json`** — generative-AI surgical-pathology drafting device under De Novo with mandatory human-in-the-loop attestation interlock, per-section provenance, refusal-on-ambiguity behavior, and pathologist-override AI Incident Card emission.
- Cross-spec linkage in `linked_records` to Agent Cards, Decision Cards, bias-coverage bundles, medical Incident Cards, and FHIR access audit streams.
- Lifecycle state machine (12 valid states + valid transition map) and PCCP scope/modification/boundary structure per FDA December 2024 final guidance.
- Standing public-language guardrail respected in README and inline.

### Not yet

- AJV-based JSON Schema validation (currently the verifier checks structural rules; schema-level validation is delegated to consumers).
- Schema-level enforcement of the relationship between `regulatory_pathway.pathway` and the corresponding number field (e.g. pathway = `510(k)` implies `k_number` populated once cleared).
- IMDRF SaMD risk category I–IV mapping table to FDA class I–III equivalents (planned Phase 2).
- Special Controls catalog for known AI/ML product codes (Phase 2).
- A canonical example for a Class III PMA — current set covers 510(k), 510(k)+PCCP, and De Novo but not full PMA.
