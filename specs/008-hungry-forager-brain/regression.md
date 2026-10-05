# Regression: the v0 simulator and the small brain (T087, T088)

- **Date:** 2026-10-05
- **Baseline:** [baseline.txt](baseline.txt) (T001, T002): 257 JavaScript tests, 95 extractor tests, pyarrow 25.0.1, numpy 2.5.3.

## Test suites

| Suite | Baseline | Now | Notes |
|---|---|---|---|
| `npm test` (JavaScript) | 257 passing | 350 passing, 0 failing | The 257 are unchanged in value. Two expectations of `tests/snapshot.test.mjs` changed (see below). |
| `python -m unittest discover -s extract/tests -t extract` | 95 passing | 158 passing, 0 failing, 1 skipped without `MALECNS_DIR` | The skipped test is `test_small_unchanged`, run with the dataset (below). |

### The two deliberate expectation changes

The container reader now accepts version 4 (contracts/container-v4.md), so two expectations that named "this build supports 3"
move to "supports 3 and 4":

- `tests/snapshot.test.mjs`: the version 2 message, and the "unsupported version" case, now uses version 5 (version 4 is a
  supported version). The same change is in `extract/tests/test_container.py` (`test_rejects_version_5`).
- No value of the v0 golden test (`tests/lif-golden.test.mjs`), the v0 LIF tests, `tests/fly-brain.test.mjs`,
  `tests/antennal-lobe-brain.test.mjs` or `tests/snapshot.test.mjs` (other than the message above) changed.

## Golden and v0 checks

- `tests/lif-golden.test.mjs` passes unchanged: the toy trace is tick by tick the same as before the rename to `lif-v0.js`.
- `tests/lif-v1.test.mjs` G1 (bit-exact with defaults, on the toy golden drive and on a CSR snapshot drive) passes.
- `scripts/compare-baseline.mjs --world=world/world-connectome.json --verbose` gives output **identical** to the baseline
  record in `baseline.txt` (T088). The v0 arm is unchanged.

## Small brain (version 3 extraction)

`extract/tests/test_small_unchanged.py` (run with `MALECNS_DIR=data/malecns`) re-extracts
`extract/configs/smallest-functional-brain.json` and compares it with `public/brains/smallest-functional-brain.brain`:
the body is byte-identical and the header is identical apart from `provenance.createdAt` and `provenance.configHash`.

The `configHash` in the committed file was produced from an earlier state of the config. The HEAD code gives the same hash as
the current code for the current config, so this predates the forager work. It is recorded in
[gate-a.md](gate-a.md) and is not changed here.
