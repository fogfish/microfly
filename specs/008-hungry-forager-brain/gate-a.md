# Gate A: extractor on MaleCNS v1.0 (forager kind)

- **Date:** 2026-10-05
- **Config:** `extract/configs/forager-brain.json` (format 3, kind `forager`, ADR 003 D6)
- **Dataset:** `data/malecns` (male-cns-v1.0, traced-only), row counts checked against the config's `expect`
- **Output:** `public/brains/forager-brain.brain` (container version 4, 3,044,476 bytes)
- **Command:** `cd extract && MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract --config configs/forager-brain.json --out ../public/brains/forager-brain.brain`

## Report (run 1)

```text
dataset        male-cns-v1.0 (traced-only), forager kind
neurons        3408   (inputs 930, outputs 12, interneurons 2466)
edges          205129
pools:
  odour-left       131 neurons,    4498 edges in
  odour-right      131 neurons,    5197 edges in
  taste-left       317 neurons,    6241 edges in
  taste-right      351 neurons,    7846 edges in
  turn-left          2 neurons,     329 edges in
  turn-right         2 neurons,     351 edges in
  forward            2 neurons,     206 edges in
  backward           4 neurons,     842 edges in
  feed               2 neurons,     193 edges in
side balance   odour: left 131, right 131
side balance   taste: left 317, right 351
edges into outputs: turn-left 329, turn-right 351, forward 206, backward 842, feed 193
feed (MN9) edges 193 from 2 neuron(s)
weights        min -0.9, max 1; synapses min 1, max 973
output         public/brains/forager-brain.brain (3044476 bytes)
self-check     identical
```

## Gate A checks

| Check (ADR 003 Acceptance, Gate A) | Result |
|---|---|
| Neuron count in `neuronCountRange` [2000, 6000] | **pass**: 3,408 |
| Every output pool receives an edge (`E-OUTPUT-UNREACHED` does not fire) | **pass**: smallest is `feed`, 193 edges |
| Odour pools side-matched | **pass**: 131 and 131 |
| Taste sides | 317 and 351. Taste is not side-matched (`sideMatch.taste` false), as the ADR allows |
| Every non-output neuron has sign ±1; sign-0 outputs have no outgoing edge | **pass** (checked by the browser reader and `tests/forager-artifact.test.mjs`) |
| Within-run self-check | **identical** |
| Byte identity across two separate runs, apart from `provenance.createdAt` | **identical** (see the timing section) |
| Report printed | **yes** |

## Timing and memory (`extract/tests/bench_forager.py`, two child processes)

| Run | Wall time | Peak resident memory |
|---|---|---|
| 1 | 59.3 s | 3,092 MB |
| 2 | 60.7 s | 2,959 MB |

The two outputs are byte-identical apart from `provenance.createdAt`. Memory is the dominant cost; it is higher than the
ADR's "restricted edge table" estimate suggests and is recorded here rather than tuned away (see Risks in plan.md).

## Comparison with ADR 003 Annex A4

The Annex A4 prototype gave 3,882 neurons, 222,046 edges, and MN9 18 edges, at a 3,000 budget split evenly. The shipped
extractor gives 3,408 neurons, 205,129 edges and MN9 193 edges. The differences are the rules as implemented, not a
change of data:

1. The sensory exclusion (D3 step 4) is applied. The Annex prototype did not apply it, so its count includes
   non-input olfactory and gustatory bodies that the exclusion now removes.
2. Output pools are sinks: their outgoing edges are dropped before the flows are computed, not only in the induced
   subgraph. No flow passes through an output.
3. An interneuron candidate needs a positive flow score (a body with no path is not chosen).

The MN9 result changes the open question Q4. MN9 has 193 incoming edges from the two MN9 bodies, not 18. The `feed`
output is not silent under this rule, so the taste budget does not have to be raised for Gate C. This is a finding, and
Gate C still measures whether the fly eats.

## Regression of the small brain (v3 path)

`extract/configs/smallest-functional-brain.json` re-extracted with the current code: the body (offsets, targets,
weights, synapses) is byte-identical to `public/brains/smallest-functional-brain.brain`, and the header is identical
apart from `provenance.createdAt` and `provenance.configHash`. The HEAD code, run in a separate worktree, gives the same
bytes as the current code. The `configHash` in the committed file (`sha256:75e375b7…`) is therefore from an earlier
state of the config; it predates this feature and is not changed here. Regenerating the committed file would update only
that field.
