# ADR 008: Steering regime for the wide-I/O brain: background noise in the bulk, not a new input or readout

- **Status:** Proposed. A7 is done: no robust candidate at 11K. Q4 is open.
- **Date:** 2026-10-16
- **Supersedes:** nothing. Revises how [ADR 005](005-dynamical-regime.md) L7′ is *used* for class-seeded brains, not
  the mechanism.
- **Extends:** [ADR 007](007-wide-io-forager-brain.md) ("Calibration protocol"), [ADR 005](005-dynamical-regime.md)
  (L7, L7′, L8, the staged A1/A2/B calibration). The mock, v0, v1, 11K and wide brains and their worlds stay
  loadable.
- **Numbering:** decisions continue at **D21**. This ADR adds **no LIF mechanism and no runner mechanism**.
- **Inputs:** [spec 012 BUG-001](../specs/012-class-seeded-forager-brain/bugs/BUG-001.md) (class-seeded CSR indexed by
  bodyId), [spec 013 BUG-001](../specs/013-wide-io-forager-brain/bugs/BUG-001.md) (calibration never gated steering),
  the measurements in [Annex A](#annex-a-measurements), all on the re-extracted `forager-brain-wide.brain`.
- **Intended consumer:** the `/microfly-calibrate` session for the wide brain (and, after it, the 11K brain).

## Context

Until 2026-10-16 every class-seeded snapshot (11K, wide) was indexed by bodyId instead of by its neuron records, so
its senses and motors were wired to unrelated neurons (spec 012 BUG-001). Every calibration of those brains fitted
that scrambled network, and the gate that should have rejected it was off (spec 013 BUG-001). After the re-extraction
and with a signed steering gate, the inherited A1 grid (synapticScale 10–50, noise confined to the input pools)
passes **no point of 2,880** (Annex A1).

This ADR was planned with three changes: a graded (stochastic) input code, larger or graded readout pools, and an
unmatched heat pool. The measurements below reject all three and point at a calibration region instead:

| Change considered | Measured (Annex) | Verdict |
|---|---|---|
| Stochastic (Bernoulli) input instead of constant drive | food 0.010 vs 0.066, heat 0.376 vs 0.363 at full contrast (A3) | no gain; rejected |
| Larger or graded readout pools | the raw turn-pool input, before any readout, already has the wrong or no food/heat sign (A2, A4) | cannot fix the sign; deferred |
| Heat pool without side matching (VP2 4 / 3) | heat −0.12 ± 0.04 (9/12) vs −0.23 ± 0.05 (11/12) matched (A6) | worse, adds a side bias; rejected |
| **Background noise in the bulk at low synapticScale** | heat away 11/12, touch toward 12/12, food toward 10/12 (A6) | **adopted as the calibration region** |

## Why the bulk has to be noisy

With noise only on the sensory pools (ADR 005 L7′ at `noiseBulkScale` 0), the bulk is silent at rest, and a
sensory spike reaches the motors only along routes whose every neuron crosses threshold.

- **Heat dies at the second hop.** Its pool fires at +7.9e-2 per step. Its 87 first-hop targets reach +3.2e-3, and
  the 1,325 second-hop neurons +2.7e-5, which is noise (A2). Touch dies at the same hop. Food, with 138 neurons a
  side, still carries at hop 3.
- **What survives is a shared side route.** Across a 4 × 4 scan of synapticScale × inhibitoryScale, food and heat
  turn with **the same sign** at every point (A4). The linear probe on the same graph gives them **opposite** signs:
  food +1.2e-7, heat −2.3e-5. The spiking network expresses a route common to both antenna senses, and drops the
  sense-specific, partly inhibitory routes that the linear probe sums.

Sub-threshold neurons do not pass a signal in proportion, and silent inhibitory neurons do not inhibit. Background
noise keeps the bulk near threshold, so a small input changes firing probability roughly in proportion. That is the
regime the linear probe assumes. With noise in the bulk at synapticScale 3–7, the predicted signs appear (A5, A6).
Lowering bulk noise to 0.25 of the input noise makes the bulk fall silent again, and the heat signal goes to exactly 0.

ADR 005 Annex B confined noise to the inputs because, on the v1 flow-ranked brain at synapticScale 50, noise
ignited the network. At synapticScale 3–7, the class-seeded bulk with noise stays at 1e-3 to 1.5e-2 spikes per
neuron per step (A5), within A1's rest gates. The two findings do not conflict: they are different brains at
scales an order of magnitude apart.

## Decisions

### D21. The wide brain's A1 grid moves to the bulk-noise region

`profiles/wide-io.mjs` axes: `synapticScale` 3–7, `inhibitoryScale` 0.5–1.5, `noise` (amplitude, bulk scale) ∈
{(0.3, 0.5), (0.4, 0.5), (0.2, 1), (0.3, 1)}, `adapt` as before, `thresholdJitter` {0, 0.1}, `stimulus` as before:
960 points. The reference point is the Annex A6 point (5, 1, (0.4, 0.5)). Every parameter is an existing LIF one
(`noiseAmplitude`, `noiseBulkScale` from ADR 005; `inhibitoryScale` L8), so `lif-v1.js` and the golden test are
untouched.

### D22. The A1 probe must see the contrast it gates

1. **Probe length is per profile.** `profile.probe = { seeds, ticks }`; the wide profile uses 6 seeds × 400 ticks.
   The default stays 3 × 150, so v1 and 11K checkpoints keep their meaning.
2. **Raw output input is averaged over every LIF step of a tick.** Reading it once per tick sampled one step in five.
   That aliases with the fixed firing cycle of a constant-driven pool: drive ≥ 1 fires every 3 steps, [0.51, 1)
   every 4. The network update is unchanged, because the tick is run as single runner steps with the same drive.
3. **The per-seed test is statistical.** A gated steering pair must have sign × mean ≥ `zMin` (2) × standard error
   over the probe seeds, as well as the pooled minimum. Requiring every seed to have the sign was tried first; it
   rejects heat, which holds its sign in 11 of 12 seeds.

### D23. Not changed, and why

- **No input code** (L9, stochastic input): no measured gain at full contrast (A3). It may still matter for small
  L/R gradients in the world. That is a world-stage question, to be reopened only with a world-stage measurement.
- **No readout change:** the steering sign is decided before the readout (A2, A4). A2 now fits one shared turn
  scale (spec 013 BUG-001), which keeps the readout from adding a bias.
- **Heat stays side-matched (3 / 3):** the unmatched pool steers less and adds a left bias (A6).

## Calibration protocol

Unchanged in its stages (A1 → A2 → B, calibration seeds only, held-out for the verdict, a human adopts), with D21
and D22. The A1 result is recorded in [spec 013 calibration.md](../specs/013-wide-io-forager-brain/calibration.md).

## Consequences

- Calibration of the wide brain searches where the network can carry signed, sense-specific steering. Whether a
  point also passes the rest, feed and rest-bias gates is the A1 run's finding (Annex A7).
- Food steering stays weak. The cut carries 14 % of the whole graph's food contrast (ADR 007 D19), and in the
  spiking network food reaches 10 of 12 seeds at best. If A1 finds heat and touch but not food, ADR 007's Q5/ADR 006
  Q6 (a larger cut, 12,000 neurons gave 28 %) is the next lever, not the LIF.
- The 11K brain needs the same treatment: re-calibration on its re-extracted snapshot (spec 012 T055), with its
  profile moved to the same region if its A1 also fails.

## Result (A7, A8)

D21/D22 move the wide brain from "no sense steers reliably" to "touch and heat steer as predicted at most and many
points", but **no robust candidate exists at 11,000 neurons, because food does not steer** anywhere in the region.
Nothing is adopted. The 12,000-neuron cut doubles the food signal at the A6 point (A8). Moving the shipped cut to it
is an extraction-config decision (Q4), not a parameter search.

## Open questions

- **Q4. Ship the 12,000-neuron cut?** *Answered by [ADR 009](009-output-partner-seeds.md): output-partner seeds at
  14,500 neurons, not a larger fill (food 92 % of the whole graph).* `fill.neuronCount` 12,000 in `forager-brain-wide.json` is within D18's range
  and adds no rule. It needs a re-extraction, the fidelity checks (ADR 007 A4 says all keep their sign), and an A1
  run on the new snapshot (about 3 h at D22's probe). The 11K snapshot is ADR 007 Gate C's arm 2's neighbour, so the
  comparison arms would also need updating.

- **Q1. Rest turn bias.** At the A6 point the rest bias is 0.6–0.8 of the food turn magnitude, above the 0.3 gate.
  Bulk noise drives the two turn pools unequally at rest. Is that the DNa01/DNa02 left/right inflow asymmetry of the
  cut, or noise that a longer probe removes? The A1 run reports it per point.
- **Q2. Heat sign against scale.** Heat turns away at synapticScale 3–7 with bulk noise, but toward at 10 with input
  noise only (A4). The sign of a sense in this brain depends on the regime, as ADR 007 A5 found for danger against
  hop count. A world run should report heat avoidance per candidate, not assume it.
- **Q3. Feed.** `feedContrast` was still near 0 or negative at the A6 point. Mouth taste reaches MN9 in the linear
  probe (+1.3e-5); whether bulk noise lets it through is part of A7.

## Annex A: measurements

All on the re-extracted `forager-brain-wide.brain` (spec 012 BUG-001), brain-only, with `lif-v1.js` unchanged.
"Contrast" is the engine's `turnContrast`: the L/R turn contrast of raw output input, over the mean turn magnitude,
> 0 toward the stimulated side. Food is probed at 0.8, the other senses at 1.0. Unless noted: `noiseAmplitude` 0.2,
`tauAdapt`/`adaptStep` 50/0.05, `thresholdJitter` 0.1, 5 LIF steps per tick, raw averaged over every step. The
harness is a scratch script that drives `createNetwork`/`step` directly; it is not part of the repository.

### A1. The inherited grid on the re-extracted brain (2026-10-16)

2,880 points (synapticScale 10–50, input-only noise), 3 seeds × 150 ticks, signed steering gates: **0 pass**. Of the
186 that pass the rest, ceiling and gain gates, 13 have food toward, heat away and touch toward. Re-probed on seeds
4–6 and 7–9, food and heat flip sign in most of those 13. Touch keeps its sign.

### A2. Where activity dies (synapticScale 15, inhibitoryScale 2, adapt 100/0.1, input-only noise)

Mean spikes per neuron per step, stimulus minus rest, by out-edge hop from the pool:

| Pool | hop 0 | hop 1 | hop 2 | hop 3 | Layer sizes 0/1/2/3 |
|---|---|---|---|---|---|
| heat-left | 7.9e-2 | 3.2e-3 | 2.7e-5 | 7.5e-4 | 3 / 87 / 1,325 / 7,568 |
| odour-food-left | 9.0e-2 | 1.5e-2 | 9.7e-3 | 1.6e-3 | 138 / 303 / 3,832 / 4,711 |
| touch-left | 8.7e-2 | 4.5e-3 | −3.7e-5 | −1.1e-4 | 95 / 45 / 1,232 / 3,843 |

### A3. Input code (8 seeds × 400 ticks, input-only noise)

| Point | Code | Food | Heat | Touch | Danger |
|---|---|---|---|---|---|
| ss 10, is 2 | constant | 0.066 ± 0.027 (6/8) | **+0.363 ± 0.032 (8/8)** | +1.995 (8/8) | −0.035 ± 0.024 |
| ss 10, is 2 | Bernoulli | 0.010 ± 0.027 (5/8) | +0.376 ± 0.036 (8/8) | +1.993 (8/8) | −0.061 ± 0.047 |
| ss 15, is 2 | constant | −0.026 ± 0.040 (3/8) | +0.186 ± 0.050 (7/8) | +1.181 ± 0.145 (8/8) | 0.028 ± 0.043 |
| ss 15, is 2 | Bernoulli | −0.031 ± 0.050 (3/8) | +0.128 ± 0.055 (7/8) | +1.612 ± 0.166 (8/8) | −0.017 ± 0.040 |

Bernoulli: each pool neuron independently receives a suprathreshold kick with probability value × ⅓ per step (the
constant code's maximum rate). Heat is significant, but **toward** the hot side, against the linear probe.

### A4. Food and heat share their sign (6 seeds × 300 ticks, input-only noise)

| synapticScale \ inhibitoryScale | 1 | 2 | 4 | 8 |
|---|---|---|---|---|
| 10 | −0.03 / −0.07 | +0.10 / +0.35 | +0.12 / +0.62 | +0.64 / +0.77 |
| 15 | +0.01 / 0.00 | −0.07 / −0.05 | −0.07 / +0.14 | +0.34 / +0.27 |
| 20 | +0.03 / −0.04 | +0.01 / −0.02 | −0.15 / −0.09 | −0.09 / −0.20 |
| 30 | +0.05 / +0.08 | −0.05 / −0.05 | +0.01 / −0.04 | −0.02 / +0.03 |

Cells are food / heat contrast. The predicted pair (food +, heat −) does not occur.

### A5. Background noise in the bulk (6 seeds × 300 ticks), selected rows

| ss | is | noise (amp / bulk) | Food | Heat | Touch | Rest / step |
|---|---|---|---|---|---|---|
| 5 | 1 | 0.2 / 1 | +0.204 ± 0.086 | −0.303 ± 0.176 | +1.621 | 2.3e-3 |
| 5 | 1 | 0.4 / 0.5 | +0.206 ± 0.143 | −0.153 ± 0.039 | +1.560 | 3.4e-3 |
| 10 | 1 | 0.4 / 0.5 | −0.045 ± 0.073 | −0.142 ± 0.029 | +1.759 | 2.5e-2 |
| 5 | 2 | 0.4 / 0.5 | +0.016 ± 0.013 | −0.019 ± 0.005 | +0.538 | 2.9e-3 |
| 15 | 2 | 0.4 / 1 | +0.011 ± 0.012 | −0.026 ± 0.014 | +0.148 | 2.4e-2 |

27 points were scanned (ss 5/10/15 × is 1/2/4 × three noise settings). Heat turns away at most bulk-noise points.
Food toward appears only at ss 5, is 1. Stronger inhibition with bulk noise shrinks every contrast.

### A6. Confirmation (12 seeds × 400 ticks, noise 0.4 / bulk 0.5 unless noted)

| Point | Food (+) | Heat (−) | Touch (+) | Danger | Rest / step |
|---|---|---|---|---|---|
| ss 3, is 1 | +0.021 ± 0.006, 9/12 | −0.042 ± 0.014, 11/12 | +1.23, 12/12 | 0.00 | 1.5e-3 |
| **ss 5, is 1** | **+0.133 ± 0.072, 10/12** | **−0.226 ± 0.049, 11/12** | **+1.58, 12/12** | −0.06, 9/12 | 3.4e-3 |
| ss 7, is 1 | −0.055 ± 0.042, 5/12 | −0.319 ± 0.081, 11/12 | +1.85, 12/12 | −0.06 | 1.1e-2 |
| ss 5, is 0.5 | −0.008, 6/12 | −0.042, 10/12 | +0.54, 12/12 | 0.00 | 5.6e-3 |
| ss 5, is 1.5 | −0.003, 6/12 | −0.053, 12/12 | +1.31, 12/12 | −0.02 | 3.2e-3 |
| ss 5, is 1, noise 0.3 / 0.5 | +0.096 ± 0.081, 9/12 | −0.214 ± 0.059, 8/12 | +1.84, 12/12 | −0.02 | 7.8e-4 |
| ss 5, is 1, noise 0.2 / 1 | +0.054 ± 0.121, 10/12 | −0.237 ± 0.067, 11/12 | +1.61, 12/12 | −0.02 | 2.3e-3 |
| ss 5, is 1, noise 0.4 / 0.25 | −0.217, 1/12 | 0.000, 0/12 | +2.00, 12/12 | −0.08 | 9.6e-4 |
| ss 5, is 1, **heat unmatched 4 / 3** | +0.125 ± 0.057, 9/12 | −0.122 ± 0.043, 9/12 | +1.46, 12/12 | −0.08 | 2.9e-3 |

The "x/12" counts are seeds with the predicted sign. The unmatched-heat row is a scratch extraction with
`sideMatch.heat: false`. It was not shipped.

### A7. A1 on the D21 grid with D22 probes (2026-10-16)

960 points, 6 seeds × 400 ticks, raw averaged over every LIF step, signed and seed-tested steering gates, 8 shards in
about 3 h (the D22 probe costs ~37 s per point under load, more at busy points). Checkpoints:
`runs/wide-io-regime-adr008/`.

| | Inherited grid (A1) | D21 grid |
|---|---|---|
| Points | 2,880 | 960 |
| Pass the rest, ceiling and gain gates | 186 | **537** |
| … and steer toward touch | 121 | **536** |
| … and steer away from heat | 43 (did not replicate) | **119** |
| … and steer toward food | 95 (did not replicate) | **6** |
| … all three | 13 | 2 |
| Pass every gate | 0 | 1, isolated (0 of 9 neighbours pass); **0 robust** |

Of the 20 points that fail exactly one gate, 19 fail food only. Over the 537 regime-passing points the food contrast
has median 0.001 (p10 −0.069, p90 0.045). **Food is the binding constraint.** The bulk-noise region fixes heat and
touch, and nothing in it makes food steer. The one passing point (ss 5, is 1, noise 0.3 / 0.5, stimulus [0, 0.5],
adapt 50 / 0.05, jitter 0.1) has food 0.04–0.16 and heat 0 to −0.2 per seed. It is not a candidate under ADR 005's
robustness rule.

### A8. The 12,000-neuron cut (ADR 007 Alternatives, D18's size knob), one point each

`forager-brain-wide.json` with `fill.neuronCount` 12,000 (seeds 7,852, fill 4,148), extracted to scratch and not
shipped. 12 seeds × 400 ticks, ss 5, is 1:

| Noise (amp / bulk) | Cut | Food (+) | Heat (−) | Touch (+) | Danger |
|---|---|---|---|---|---|
| 0.4 / 0.5 | 11K | +0.133 ± 0.072, 10/12 | −0.226 ± 0.049, 11/12 | +1.58, 12/12 | −0.06, 9/12 |
| 0.4 / 0.5 | 12K | +0.103 ± 0.061, 9/12 | −0.331 ± 0.159, 11/12 | +1.26, 12/12 | −0.17, 8/12 |
| 0.3 / 0.5 | 11K | +0.096 ± 0.081, 9/12 | −0.214 ± 0.059, 8/12 | +1.84, 12/12 | −0.02 |
| 0.3 / 0.5 | **12K** | **+0.182 ± 0.052, 11/12** | **−0.467 ± 0.127, 11/12** | +1.84, 12/12 | 0.01 |

These are two points, not a grid. They agree with ADR 007's linear measurement (food contrast 14 % → 28 % of the whole
graph from 11K to 12K) and are the reason for Q4.
