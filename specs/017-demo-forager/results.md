# Results (Part K): demo forager acceptance report

| Requirement | Metric | Verdict | Brain (B) | Random walk (RW) | Random graph (RG) |
|---|---|---|---|---|---|
| R6 (SC-009) | K-none (inspection, not a run) | pass | n/a | n/a | n/a |

**R6 / SC-009** ("no separate per-pool balance calibration step exists"): verified by inspection, not a run —
`decoder-engine.mjs`'s C1/C2/C3 stages (`runC1`, `runC2`, `runC3`) contain no balance-fitting stage; C2 seeds
`homeostasis.rest` once per pool from its own rest-condition measurement (contracts/decoder-v1.md), and D33's
online homeostasis (`decoder.js`'s `decodeTick`) is the only mechanism that ever adjusts `rest`/`balance`
afterwards, at runtime, per fly (`tests/homeostasis.test.mjs`). This holds independently of whether C1/C2 pass
on any given snapshot.

**R1-R5 (K1-K9): blocked, not yet measured.** `public/brains/forager-brain-wide.decoder.json` does not exist:
the demo-v3 calibration run's C1 regime check failed on the real `forager-brain-wide.brain` snapshot, after an
extensive widened search — see `calibration.md` for the full record (dated 2026-10-17). Per this feature's
explicit instruction, calibration is deliberately not being retried while the remaining demo features are
completed; these rows will be filled in once calibration is restarted (either against a revised grid/LIF
block, or a different brain) and a `decoder-v1` file exists to run `scripts/forager-arms.mjs` against.
