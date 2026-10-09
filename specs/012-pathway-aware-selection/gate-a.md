# Gate A: extractor on MaleCNS v1.0 (forager kind, pathwayBias)

- **Date:** 2026-10-09
- **Config:** `extract/configs/forager-brain.json` (format 3, kind `forager`, ADR 003 D6 + D3′) — now declares one
  `pathwayBias` rule: `{"id": "taste-forward-brake", "pathway": "taste", "intoOutput": "forward"}`
- **Dataset:** `data/malecns` (male-cns-v1.0, traced-only), row counts checked against the config's `expect`
- **Output:** `public/brains/forager-brain.brain` (container version 4, 2,954,056 bytes)
- **Command:** `cd extract && MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract --config configs/forager-brain.json --out ../public/brains/forager-brain.brain`

## Report (run 1)

```text
dataset        male-cns-v1.0 (traced-only), forager kind
neurons        3320   (inputs 930, outputs 12, interneurons 2378)
edges          198756
pools:
  odour-left       131 neurons,    4498 edges in
  odour-right      131 neurons,    5197 edges in
  taste-left       317 neurons,    6088 edges in
  taste-right      351 neurons,    7646 edges in
  turn-left          2 neurons,     208 edges in
  turn-right         2 neurons,     237 edges in
  forward            2 neurons,     638 edges in
  backward           4 neurons,     424 edges in
  feed               2 neurons,      19 edges in
side balance   odour: left 131, right 131
side balance   taste: left 317, right 351
edges into outputs: turn-left 208, turn-right 237, forward 638, backward 424, feed 19
feed (MN9) edges 19 from 2 neuron(s)
pathwayBias taste-forward-brake  boosted 1227, admittedOnlyByRule  708
weights        min -0.580952, max 0.452381; synapses min 1, max 741
output         ../public/brains/forager-brain.brain (2954056 bytes)
self-check     identical
```

## Gate A checks

| Check (ADR 003 Acceptance, Gate A) | Result |
|---|---|
| Neuron count in `neuronCountRange` [2000, 6000] | **pass**: 3,320 |
| Every output pool receives an edge (`E-OUTPUT-UNREACHED` does not fire) | **pass**: smallest is `feed`, 19 edges |
| Odour pools side-matched | **pass**: 131 and 131 |
| Taste sides | 317 and 351. Taste is not side-matched (`sideMatch.taste` false), as the ADR allows |
| Every non-output neuron has sign ±1; sign-0 outputs have no outgoing edge | **pass** (checked by the browser reader and `tests/forager-artifact.test.mjs`) |
| Within-run self-check | **identical** |
| Report printed | **yes**, including the new `pathwayBias` line (contract, data-model.md) |

**Finding — `admittedOnlyByRule` is large on the real dataset.** The `taste-forward-brake` rule boosts 1,227 admitted
taste interneurons and 708 of those (58% of the taste budget's own 1,500 slots) would not have been admitted by
plain reachability alone. This is a much bigger effect than the small, hand-crafted synthetic fixture shows (there
it swaps exactly one body). Per `AGENTS.md`'s "behaviour failures are findings" rule this is recorded as-is, not
tuned away — see the topology comparison below and Gate C for whether it changes measured behaviour.

## Comparison with the current forager brain

`extract/tests/compare_forager_topology.py`, run against `data/malecns`: `select_forager` twice in the same
process on the same dataset load — once with `config["pathwayBias"]` forced to `[]` (today's shipped topology,
contract P1), once with `forager-brain.json` as shipped (one rule: `taste-forward-brake`).

| Measure | Without the rule | With the rule | Delta |
|---|---|---|---|
| Interneurons | 2,466 (791 of them not shared with the ruled run) | 2,378 (703 of them new) | net −88 |
| Edges | 205,129 | 198,756 | −6,373 |

- **Added bodies**: 703, all `taste` pathway. Every one has a strictly positive rule-seeded backward flow for
  `taste-forward-brake` (sanity check `ruleExplained`, data-model.md) — confirmed: **True**, min value 0.0178,
  most at 1.0 (directly reachable to an inhibitory in-edge of `forward`).
- **Removed bodies**: 791 — displaced from the taste (and in some cases odour) budget union by the 703 added
  bodies' higher scores, consistent with the taste budget's own slot count staying fixed at 1,500 (contract P4;
  net neuron count still shifts because the odour/taste union's overlap changes, not because any budget's own
  count did).
- **Significant difference**: **yes** — stated plainly, not tuned away (`AGENTS.md`'s "behaviour failures are
  findings"). The effect is far larger on the real dataset (703/791 bodies swapped) than on the small synthetic
  fixture (one body swapped by construction). This reflects the dataset's actual connectivity: the `forward`
  output pool has a large number of inhibitory in-edges on MaleCNS v1.0 (638 edges into `forward`, see the report
  above), so the rule's seed set is large and reaches deep into the taste pathway's candidate pool. Gate C (below)
  measures whether this changes the fly's held-out behaviour, rather than assuming it from the topology diff alone.

## Byte identity across two separate runs

Two full extractions (`cd extract && MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract --config
configs/forager-brain.json --out <file>`), each in its own process, into separate output files. Compared byte for
byte after stripping `provenance.createdAt`: **identical**.

## Regression of the small brain (v3 path)

`extract/configs/smallest-functional-brain.json` is `formatVersion: 2` (no `kind`), dispatched to `format_of` as
`"small"` and validated/selected by `malecns_brain.config.validate` / `malecns_brain.selection.select_brain` — the
ADR 002 code path. This feature only touches `validate_forager` (format 3), `select_forager`, and the forager-only
`report_forager`; the small-brain validator, selector, and report function are unmodified (confirmed by diff). No
re-extraction is needed to confirm no regression: the code path a format-2 config runs is untouched by this change,
and `tests/test_config_forager.py::test_shipped_small_config_still_dispatches_to_small` keeps passing.
