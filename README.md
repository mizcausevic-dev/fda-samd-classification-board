# fda-samd-classification-board

> **FDA SaMD Classification Board v0.1 draft.** Hash-chained, append-only record schema + reference verifier for an AI/ML medical device's FDA Software-as-a-Medical-Device classification lifecycle — pre-submission posture, submission pathway (510(k) / De Novo / PMA), clearance state, **Predetermined Change Control Plan** (PCCP) status per FDA's December 2024 final guidance, post-market modification triggers, and 21 CFR §820 QMS evidence references. Bridges FDA's regulatory pathway taxonomy to the Kinetic Gain Protocol Suite audit-stream spine so a buyer, an auditor, or the manufacturer's regulatory team reads one verifiable record across the device's full lifecycle.

Part of the [Kinetic Gain Protocol Suite](https://suite.kineticgain.com).

> Status: v0.1 draft. Schema at [`schema/samd-classification-record.schema.json`](./schema/samd-classification-record.schema.json), three worked examples at [`examples/`](./examples/), reference verifier in [`src/verify.mjs`](./src/verify.mjs).

## Why this exists

The FDA regulatory file for an AI/ML medical device is currently a mosaic of artifacts that nobody outside the manufacturer's regulatory team reads end-to-end:

- A pre-submission Q-Sub package goes to FDA;
- A 510(k) summary, De Novo decision letter, or PMA approval order goes onto FDA's public databases;
- A Design History File, ISO 14971 Risk Management File, IEC 62304 software lifecycle file, IEC 62366 usability engineering file, and clinical evaluation report live in the manufacturer's QMS;
- A Predetermined Change Control Plan (PCCP) defines *which* future modifications can ship without a new submission — but its scope, modification list, and boundary conditions are typically buried in the cleared submission's attachments;
- Post-market: corrective actions, MDR adverse events, and PCCP-triggered changes accumulate in separate filings.

A hospital buyer, an HHS OCR investigator, an external auditor, or even a vendor's own post-market surveillance team trying to answer "*what is the regulatory state of this device right now?*" reconstructs that picture by hand each time. The reconstruction is slow, error-prone, and rarely tamper-evident.

This repo defines the canonical record that answers the question: a single append-only document, hash-chained, signable, machine-readable, that names every transition (Q-Sub → submission → AI request → clearance → PCCP trigger → post-market action) with its trigger and supporting reference. The schema's lifecycle state machine is constrained — invalid transitions (e.g. jumping from `pre-submission-design` straight to `marketed`) are rejected by the verifier — so the record can't tell a regulatorily-implausible story.

## What's in the record

| Field | Required | Purpose |
| --- | :---: | --- |
| `record_version` | ✓ | Schema version (`0.1`) |
| `record_id` | ✓ | Stable record identifier |
| `device` | ✓ | Product name + model version + vendor + intended use + IMDRF SaMD risk category + UDI |
| `current_classification` | ✓ | FDA class + 21 CFR regulation number + product code + 510(k) predicate |
| `regulatory_pathway` | ✓ | Pathway enum + K/DEN/PMA numbers + filing/decision dates |
| `predetermined_change_control_plan` | optional | PCCP scope + modification list + boundaries + validation protocol — REQUIRED when lifecycle is PCCP-related |
| `lifecycle_state` | ✓ | Current state in the SaMD lifecycle state machine |
| `transitions[]` | ✓ | Append-only state-machine history with triggers |
| `qms_evidence_refs` | recommended | URLs to DHF, RMF, IEC 62304, IEC 62366, clinical evaluation, evidence-bundle |
| `linked_records` | recommended | Cross-refs to other Suite documents (Agent Card, Decision Cards, bias-coverage bundles, medical Incident Cards, FHIR access audit) |
| `publisher` | recommended | Who emitted the record + role (manufacturer / US-agent / spec-developer / etc.) |
| `signature` | recommended | ed25519 signature over canonical body |
| `prev_hash` | ✓ | SHA-256 of prior record version (or 64 zeros for genesis) |
| `hash` | ✓ | Canonical-JSON SHA-256 of the body excluding `hash` itself |

## Lifecycle state machine

```
pre-submission-design ─┬─→ q-sub-filed ──→ submission-pending ──→ submission-under-review
                       │                                              │
                       └─── (skip Q-Sub) ──────────────────────────→  │
                                                                       ├─→ additional-information-requested ─┐
                                                                       │                                       │
                                                                       │  ←──────── back to under-review ──────┘
                                                                       │
                                                                       └─→ cleared-or-approved
                                                                                   │
                                                                                   ↓
                                                                                marketed
                                                                                   │
                       ┌───────────────────────────────────────────────────────────┼────────────────────────────────────────────────┐
                       │                                                            │                                                │
                       ↓                                                            ↓                                                ↓
              pccp-change-pending ──→ pccp-change-implemented ──→ marketed     post-market-corrective-action               modification-requires-new-submission
                                                                                    │                                                │
                                                                                    └──→ marketed                                    └──→ submission-pending
```

All states can transition to `withdrawn` or `superseded-by-new-version` as terminal states. The verifier in [`src/verify.mjs`](./src/verify.mjs) enforces these as the only valid transitions.

## PCCP — Predetermined Change Control Plan

Per FDA's *Marketing Submission Recommendations for a Predetermined Change Control Plan for Artificial Intelligence/Machine Learning (AI/ML)-Enabled Device Software Functions* (Final, December 2024), a PCCP authorizes a manufacturer to ship a specific, bounded set of post-market modifications **without** filing a new submission. The cleared PCCP defines:

- `scope` — a narrative of what's covered (typically performance-metric retraining or labeled-population expansion within named bounds).
- `modifications_list[]` — each modification has a `modification_id`, a `description`, a `trigger_kind` (scheduled retraining / performance drift / data source expansion / labeled-population expansion / efficiency improvement), and a `boundary` — the bound of acceptable change (e.g. "sensitivity may not drop more than 2 pp from validation baseline in any protected subgroup").
- `validation_protocol_url` — the Modification Protocol detailing how each modification will be validated before deployment.
- `impact_assessment_url` — why the modifications stay within the cleared device's safety + effectiveness profile.

The pccp-trigger example ([`examples/skinscan-v4-3-pccp-trigger.json`](./examples/skinscan-v4-3-pccp-trigger.json)) shows a concrete case: a Fitzpatrick V + VI sensitivity gap identified at deployment (via a [`clinical-bias-cohort-coverage-lab`](https://github.com/mizcausevic-dev/clinical-bias-cohort-coverage-lab) bundle) triggers the cleared PCCP's `mod-fitzpatrick-v-vi-rebalance` modification. Validation results filed with FDA. No new submission required because the modification stays within the cleared PCCP boundaries.

## Examples

| File | Pathway | Vendor | Pedagogical purpose |
| --- | --- | --- | --- |
| [`skinscan-v4-510k-class-ii.json`](./examples/skinscan-v4-510k-class-ii.json) | 510(k) Class II | VendorX SkinScan v4.2 | A clean 510(k) lifecycle — Q-Sub → submission → AI/ML interactive review request → response → cleared → marketed. The same K231234 device + intended use that appears across the rest of the HealthTech 6-pack. |
| [`skinscan-v4-3-pccp-trigger.json`](./examples/skinscan-v4-3-pccp-trigger.json) | 510(k) + PCCP | VendorX SkinScan v4.3-rc1 | A post-market PCCP modification triggered by a bias-coverage gap detected in the field. The transition chain links back to the bias-coverage bundle's `bias_coverage.gap_detected` event from #4 — the Suite working as a graph. |
| [`novel-genai-pathology-de-novo.json`](./examples/novel-genai-pathology-de-novo.json) | De Novo | Novexa PathNarrate v1.0 | A generative-AI pathology drafting device under De Novo — the hardest current FDA AI regulatory shape. Shows the AI request dialog about generative-attribution audit trail, refusal-on-ambiguity behavior, and pathologist-override Incident Card emission. |

All three pass the verifier:

```bash
$ npm run verify-all
OK:   record_version is 0.1
OK:   hash matches recomputed canonical SHA-256
OK:   prev_hash is well-formed
OK:   lifecycle state-machine consistent (7 transitions, current = 'marketed')
OK:   510(k) record carries k_number K231234

Verification PASSED.
```

## Composes with

| Repo | Role |
| --- | --- |
| [`evidence-bundle-spec`](https://github.com/mizcausevic-dev/evidence-bundle-spec) | `qms_evidence_refs.evidence_bundle_url` points at an evidence-bundle-spec bundle aggregating DHF + RMF + IEC 62304/62366 + CER |
| [`ai-procurement-decision-spec`](https://github.com/mizcausevic-dev/ai-procurement-decision-spec) | `linked_records.decision_card_urls[]` references the buyer's Decision Cards that authorized deployment / restricted intended use |
| [`agent-card-spec`](https://github.com/mizcausevic-dev/agent-cards-spec) | `linked_records.agent_card_url` references the device's Agent Card with capability + refusal disclosure |
| [`clinical-bias-cohort-coverage-lab`](https://github.com/mizcausevic-dev/clinical-bias-cohort-coverage-lab) | `linked_records.bias_coverage_bundle_url` references the bias-coverage bundle; bias-coverage gap events drive `post-market-signal-detected` transitions |
| [`medical-adverse-event-incident-card`](https://github.com/mizcausevic-dev/medical-adverse-event-incident-card) | `linked_records.medical_incident_card_urls[]` references AE Incident Cards; MedWatch-reportable events drive `post-market-corrective-action` transitions |
| [`fhir-resource-access-audit`](https://github.com/mizcausevic-dev/fhir-resource-access-audit) | `linked_records.fhir_resource_access_audit_url` points at the deployed device's FHIR access audit stream |
| [`phi-vault-contract-profile`](https://github.com/mizcausevic-dev/phi-vault-contract-profile) | Where the device handles PHI, the cited Decision Cards typically conform to the PHI Vault Contract Profile |
| [`hipaa-readiness-evidence-bundle`](https://github.com/mizcausevic-dev/hipaa-readiness-evidence-bundle) | The QMS evidence bundle often co-publishes a HIPAA-readiness bundle when the device is used by a covered entity |

## Compliance posture

Healthcare-readiness scaffolding for AI/ML medical device classification + PCCP lifecycle records. The schema and examples support a manufacturer's program toward FDA SaMD pathway readiness (Q-Sub through 510(k) / De Novo / PMA), FDA Predetermined Change Control Plan conformance, 21 CFR §820 / ISO 13485 QMS evidence collection, ISO 14971 risk management readiness, IEC 62304 software lifecycle alignment, IEC 62366 usability engineering, and IMDRF AIMD WG/N67 terminology consistency — does not by itself establish compliance with any of them. Per the standing public-language guardrail: *readiness · evidence · posture · controls · scaffolding* — never "cleared" or "FDA-approved" without an actual FDA decision letter on file.

## License

MIT — see [`LICENSE`](./LICENSE). Spec + reference-verifier repos in the Suite are MIT-licensed so adopters can implement freely; full reference implementations are AGPL-3.0.
