# Research: Mushroom-Body Valence Learning

Phase 0 of [plan.md](plan.md). Each item: decision, rationale, alternatives. Measured facts come from the shipped
`public/brains/forager-brain-wide.brain` (14,500 neurons, 730,859 edges), read with `parseSnapshot` on 2026-10-19.

## §0 Measured starting point

| Group (dataset identity)                  | In the wide brain | Note                                               |
| ----------------------------------------- | ----------------- | -------------------------------------------------- |
| `class = Kenyon_Cell`                     | 4,064             | all cholinergic by `consensus_nt` (ADR 006)         |
| `class = MBON`                            | 97, 37 types      | including `MBON15-like`, `MBON17-like`, `MBON25-like` |
| `class = DAN`, type prefix `PAM`          | 316               | `PAM0*` 226, `PAM1*` 90                             |
| `class = DAN`, type prefix `PPL1`         | 16, 8 types       | `PPL101`–`PPL108`, 2 each                            |
| `type = APL`                              | 2                 | inhibitory feedback onto KCs                        |
| KC→MBON edges                             | 33,496            | 4.6 % of all edges: the only plastic edges          |
| Food-odour ORNs (current pair)            | DM1 70, DM2 48, DM4 30, VA2 66, VM2 34, DP1m 28 | **VM5d absent**; both sets share one input pair |

The current `odour-food` pair mixes the two odour sets the feature needs to separate, and lacks VM5d. Two food
odours therefore need a re-extraction (§1).

`learn_test.mjs` (the smallfly conditioning probe the user names) is not on this machine; the probe is rebuilt from
its description in the CHANGELOG (pair odour with PAM or PPL1, read MBON valence of paired and unpaired odours).

## §1 Two food odours: a new snapshot, the old one untouched

**Decision.** A new extraction config `extract/configs/forager-brain-mb.json`, a copy of `forager-brain-wide.json`
with the `odour-food` pair replaced by two pairs:

| Pair           | Sense           | ORN types                         | Label           |
| -------------- | --------------- | --------------------------------- | --------------- |
| `odour-food-a` | `odour:food-a`  | `ORN_DM1`, `ORN_DM2`, `ORN_DM4`   | fruit / ferment |
| `odour-food-b` | `odour:food-b`  | `ORN_VA2`, `ORN_DP1m`, `ORN_VM5d` | floral / sweet  |

plus the two optional teaching pairs of §6. It writes `public/brains/forager-brain-mb.brain`. The `hunger` modulator
targets all four food-odour channels. The extractor gains one check: two input pairs whose `types` intersect fail
with **`E-POOL-OVERLAP`**, naming both pairs and the shared type. This applies to any config, and every shipped
config passes it, since none declares overlapping pairs.

**Rationale.** The spec (FR-004/005) and AGENTS ("old brains keep working") need the wide brain and its
`decoder.json` byte-for-byte unchanged, so spec 017's Part K results stay valid. Extraction is config, not code
(Principle IV); the only code change is a validation rule.

**Alternatives.** Split the existing pair at run time by ORN type: rejected, because the snapshot's channel is the
declared contract and VM5d isn't in it. Keep VM2 in set B: rejected, because the user named VM5d, and VM2 is a
food odour in the wide brain only by ADR 006's choice.

## §2 The regime gate: what is measured and how

**Decision.** `scripts/mb-regime-probe.mjs`, brain-only (no world, no decoder), on the `experiment.seeds`
calibration seeds:

- **Protocol.** Warm up 400 ticks with no input. Then 10 trials per odour, alternating A, B, none: 100 ticks of
  odour at value 1 on both channels of the pair, then 200 ticks of rest. Hunger is 1, so the hunger gain doesn't
  silence the input. Noise continues between trials, so the trials differ; one seed alone would otherwise give
  identical trials.
- **Active KC.** A KC is active in a trial when its spike count in the odour window exceeds its mean count in the
  "none" windows by at least 2 spikes and by 2 SD. This makes a KC that fires tonically count as inactive.
- **Code vector.** The binary active vector over all KCs, per trial.
- **Measures.** (a) The active fraction per odour: the mean over trials. (b) Same-odour reliability: the mean Pearson
  correlation between all pairs of an odour's trial vectors. (c) A–B overlap: the Pearson correlation between A's and
  B's mean vectors. Targets: (a) 5–15 %, (b) > 0.85 (amended from 0.9, ADR 011 D41), (c) < 0.7.
- **Output.** `specs/019-mb-valence-learning/regime-gate.json` plus a table in `regime-gate.md`, with seeds, LIF
  block, snapshot sha256 and the verdict. The verdict is copied into ADR 011.
- The same probe runs on the matched random graph and is reported, not gated.

**Rationale.** These are the three measures the user set. A binary code with a baseline subtraction separates "the
odour recruits this KC" from "the KC is in the up-state". The research note (doc/research.md §3) records that the
prior art ran the bulk in a self-sustained up-state, where every KC fires for every odour; the A–B correlation
there is near 0.99.

**Alternatives.** Rate-vector correlation: kept as a secondary column, because an up-state inflates it less
visibly than the binary code. Probing at hunger 0.5: rejected, because the gate is about the KC code, not the
hunger curve.

## §3 The one remedy: a declared feed-forward pathway gain (LIF L11)

**Decision.** A new LIF parameter `pathwayGain` (default `null`, a no-op). When set:

```json
"pathwayGain": {
  "routes": [ { "from": "olfactory", "to": "ALPN", "gain": 5 },
              { "from": "ALPN", "to": "Kenyon_Cell", "gain": 3 } ],
  "otherExcitatoryInto": ["ALPN", "Kenyon_Cell"],
  "otherGain": 0.3
}
```

- Every excitatory edge whose presynaptic `class` is `from` and postsynaptic `class` is `to` is multiplied by
  `gain`.
- Every other excitatory edge into a class named in `otherExcitatoryInto` is multiplied by `otherGain`.
- It is applied once, to a copy of the weights, in `createNetwork`, as L8 `inhibitoryScale` already is.
- The runner passes per-neuron `class` from the snapshot manifest.
- Validation: classes must exist in the snapshot (otherwise **`E-LIF-PATHWAY`**, naming the class), gains must be
  finite and ≥ 0, and routes must not repeat.

It is tried only if the gate fails with an up-state signature (active fraction > 15 % or A–B > 0.7). It is
calibrated on calibration seeds only, in at most one grid of `gain`/`otherGain` values, and both runs are recorded
in ADR 011.

**Rationale.** The user specified this remedy. It is configured like `outputScale` (L6): a gain on a class of edges
chosen by dataset identity. Within each class, the relative weights still come from synapse counts. That keeps
Principle III: the weights are not edited, they are scaled by a named, declared parameter, as L6 and L8 already do.
doc/research.md §4 lists pathway gains among the things Principle III blocks. The difference here is that this is a
LIF gain over a declared edge class, not per-edge weights, and it goes into Complexity Tracking.

**Alternatives.** Re-extract with a higher `minSynapses` to sparsify PN→KC: rejected, because it changes the brain
for every purpose, not only the MB regime. Strengthen APL inhibition: kept as a second candidate if the gain alone
can't reach 5–15 %. It is the same mechanism (a route `APL → Kenyon_Cell`), so no new parameter is needed.

## §4 Neuron groups and MBON roles: a learning sidecar

**Decision.** A new sidecar file, contract `learning-v1`, at `public/brains/forager-brain-mb.learning.json`. It is
named by the world (`flies.brain.learning`) and resolved against the snapshot manifest at load:

- `groups.kc`: `{ "class": "Kenyon_Cell" }`
- `groups.reward`: `{ "class": "DAN", "typePrefixes": ["PAM"] }`
- `groups.punish`: `{ "class": "DAN", "typePrefixes": ["PPL1"] }`
- `mbon`: one entry per MBON **type** with its `role` (`approach` | `avoid`) and a `cite` string. Types with no
  entry are left out of learning and listed by the probe (spec edge case).

**Default roles.** Taken from Aso et al. 2014 (eLife 3:e04580), "Mushroom body output neurons encode valence and
guide memory-based action selection in Drosophila", Fig. 5–6, and Aso et al. 2014 eLife 3:e04577 (the MBON
anatomy). The sidecar has one line per type with its source. The glutamatergic MBONs (for example MBON01 γ5β′2a,
MBON03 β′2mp, MBON04, MBON05 γ4>γ1γ2) are mostly `avoid`. The cholinergic and GABAergic ones (for example
MBON11 γ1pedc>α/β, MBON12 γ2α′1, MBON14 α3) are mostly `approach`. The examples here are illustrative. Each type's
role is checked against the paper's per-type activation results when the sidecar is written, and the rule of thumb
from transmitter is never applied without that check. Where the paper shows no behavioural effect, the type gets no
role.

The sidecar is checked in, hand-written from the literature and never derived from `transmitter`. Its reader
rejects:
- **`E-LEARN-SNAPSHOT`**: the snapshot sha256 doesn't match;
- **`E-LEARN-GROUP-EMPTY`**: a group resolves to no neuron;
- **`E-LEARN-ROLE`**: an unknown role;
- **`E-LEARN-CITE`**: an MBON entry has no citation.

**Rationale.** FR-009/010: groups are config, MBON roles are per type with a citation. A sidecar beside the
snapshot follows `decoder.json` (decoder-v1), so the container format doesn't change and Python doesn't need a
reader.

**Alternatives.** Put the groups in the extraction config and snapshot header: rejected, because it would need a
container contract change on both sides for data that is about learning, not the connectome. Put them in the world
config: rejected, because the groups belong to a snapshot (indices, sha), not to a map.

## §5 Plasticity in the LIF core (LIF L12)

**Decision.** A new LIF parameter `plasticity` (default `null`, off). It runs inside `lif-v1.js` `step`, in the
worker:

| Name           | Default | Meaning                                                                                  |
| -------------- | ------- | ---------------------------------------------------------------------------------------- |
| `tauElig`      | 400     | KC eligibility trace time constant (steps). `e_i ← e_i·exp(−1/τ) + spike_i`               |
| `tauRate`      | 20      | DAN pool rate EMA (steps)                                                                |
| `tauBaseline`  | 4000    | DAN pool running baseline EMA (steps)                                                    |
| `threshold`    | 0.01    | Dopamine drive is `D = max(0, rate − baseline − threshold)` (spikes per neuron per step) |
| `etaReward`    | 0.05    | Depression rate of KC→avoid-MBON edges per unit `D_reward·e`                             |
| `etaPunish`    | 0.05    | Depression rate of KC→approach-MBON edges per unit `D_punish·e`                          |
| `wMin`         | 0.2     | Lower bound of `wmod`. The upper bound is 1                                              |
| `tauForget`    | 30000   | Recovery of `wmod` towards 1 (steps). 6,000 ticks at 5 steps per tick                    |
| `dopamine`     | `"pool"`| `"pool"`: drive from the DAN groups. `"shuffled"`: lag-shuffled drive (§8)                |
| `seed`         | —       | Not a parameter: the shuffle uses the network's seeded PRNG stream                       |

The values are starting points, to be calibrated on calibration seeds and recorded in ADR 011.

**Mechanics.**
- At `createNetwork` the core gets `graph.learning = { kc, reward, punish, approach, avoid }` (index arrays). It
  builds a `Uint32Array` of plastic edge slots (pre ∈ kc, target ∈ approach ∪ avoid), a parallel group tag, a
  `Float64Array wmod` (all 1), and a private copy of the weights.
- Each step, after the spike pass:
  1. update the KC traces;
  2. update the reward and punish pool rates and baselines;
  3. compute `D`;
  4. for each plastic slot `j` with `D_group > 0`: `wmod_j ← max(wMin, wmod_j − eta·D·e_pre)`;
  5. every `recoverEvery = 10` steps (an integer counter): `wmod_j ← wmod_j + (1 − wmod_j)·(1 − exp(−10/tauForget))`;
  6. write `weights[k] = base[k]·wmod_j` for each changed slot.
- The spike pass is unchanged, so the hot loop gains no branch.
- Off (`null`): no copy, no arrays, no work. `tests/lif-golden.test.mjs` is unchanged, and a new golden test asserts
  that `plasticity: null` and an absent key give identical spikes to the current core on the wide snapshot fixture.
- Determinism: only typed-array arithmetic in a fixed order, integer counters, and the existing seeded PRNG
  (shuffle only). A golden test runs plasticity **on** twice with the same seed and asserts identical spikes and
  `wmod`.
- Telemetry: `net.learning = { dReward, dPunish, wmodApproach, wmodAvoid }` (the means over slots), refreshed each
  step.

**Rationale.** This is the rule the user specified: per-edge `wmod ∈ [wMin, 1]` on KC→MBON only, snapshot weights
never change, an eligibility trace, baseline-minus-threshold dopamine, reward depresses avoid and punishment
depresses approach, slow recovery. Depression-only rules match the fly MB literature (Hige et al. 2015, Neuron
88:985). Recovery on a 10-step counter costs 1/10 of the per-step work and stays deterministic. The cost per step is
at most about 37K multiply-adds (traces plus active slots), small next to the spike pass over 730K edges.

**Alternatives.**
- A new `lif-v2.js`: rejected, because L1–L10 all extend v1 behind defaults and AGENTS rule 5 asks the same.
- Plasticity in the runner (`fly-brain-v1.js`): rejected, because Principle V puts it in the LIF core, and the core
  owns the weights.
- Potentiation as well as depression: rejected for v1, since it is not in D34 and would double the parameters.
- Per-compartment DAN→MBON matching: deferred. D34 names two teaching signals, and per-compartment wiring needs a
  compartment table per MBON type that the dataset columns don't give directly.

## §6 Teaching signals: measured first, injected only where needed

**Decision.** The probe `scripts/mb-teaching-probe.mjs` (brain-only, calibration seeds) measures the reward and
punish pool rates against rest under:
- mouth taste at 1 with hunger 1 versus hunger 0 (reward: does eating drive PAM?);
- heat at 1 (punishment);
- touch at 1 (punishment);
- danger odour at 1, as a proxy for the escape state, since the alarm pool fires on it;
- the escape output driven, to check the MBON/DAN back-path;
- each food odour alone (checking for unwanted PPL1 or PAM drive).

A signal counts as carried when the pool's `D` (rule §5, at the default threshold) is above 0 on ≥ 50 % of
stimulus ticks and on ≤ 5 % of rest ticks.

For every signal not carried, the world uses a declared input pair, injected and labelled:
- `reinforcement-reward-left/right`: `class: DAN`, `typePrefixes: ["PAM"]`, split by `rootSide`;
- `reinforcement-punish-left/right`: `class: DAN`, `typePrefixes: ["PPL1"]`.

These pairs are in the `forager-brain-mb` extraction config from the start (one extraction, not two). A world that
doesn't drive them sends 0, and these neurons then behave as interneurons with no external input. They are driven by
world events declared in `flies.stimuli` (world-config contract):
- `reinforcement:reward` on `eat` (the fly is eating this tick);
- `reinforcement:punish` on `escape` (an escape sprint starts), `heatContact` (heat input ≥ 0.9) and
  `eat:<scent>` for a punished scent.

The panel and the results mark each driven pair as **injected**, the same way hunger is shown as a declared
modulator.

**"Bitter" is injected.** The world has one taste sense, with no bitter receptor channel. A punished scent is
therefore delivered on `reinforcement:punish` on eating it, labelled injected. A bitter-GRN taste channel
(Gr66a/Gr33a types) is a later feature. FR-016's bitter question is answered: the cut's declared inputs carry no
bitter sense.

**Rationale.** The user's order is to measure, use the connectome as-is where it carries the signal, and inject
only otherwise. Declaring the injection as a snapshot channel on dataset DAN neurons satisfies Principle VI's
new-sense rule: declared in data, driving only named neurons, reaching behaviour only through neurons.

**Alternatives.** Drive the DANs directly from world code inside the worker: rejected, because it is not a declared
channel and breaks Principle VI. Use a modulator: rejected, because modulators scale existing channels and have no
neurons of their own.

**Side effect: noise.** Input-pool neurons receive `noiseAmplitude` even when `noiseBulkScale` is 0 (L7′). Declared
DAN pools would therefore get noise that other interneurons don't. The regime and teaching probes run with the
world's `noiseBulkScale` and report the DAN rest rate. If it differs from the wide brain's DAN rest rate by more
than its seed spread, the runner excludes undriven `reinforcement-*` pools from `inputNeurons`, recorded in ADR 011.

**Open risk.** The extractor's pool-membership rule ("a body is a member of two pools") and the DAN class seed. A
DAN in a declared input pool must move to the input section and not be counted twice in `fill`. A task checks this
on the fixture dataset before the full extraction.

## §7 Learned valence and the network-first readout

**Decision (spec FR-018/019, user choice "network first, rule fallback").**

1. **Learned valence (decoder, main thread).** For each food pair `p`, the decoder keeps an EMA (τ = 300 ticks) of
   the MBON approach-group rate and avoid-group rate, updated only on ticks when that pair's mean input ≥ 0.05. Then:
   - `bal_p = (r_app − r_avoid) / (r_app + r_avoid + ε)`;
   - `ℓ_p = clamp(1 + kValence·(bal_p − bal⁰_p), 0.5, 1.5)`, where `bal⁰_p` is the naive balance written by C2 into
     the decoder file (`learning.naive`);
   - W13 then uses `v_p·ℓ_p`. The sign of `v_p` never changes.

   This is motor decoding of spikes the worker already sends, so Principle II holds.
2. **Network-path probe.** `scripts/mb-network-probe.mjs` (brain-only, calibration seeds) conditions odour A with
   punishment (§8 protocol), then presents A with mouth taste on. It measures the change in decoded `feed` and
   `forward` drive (pool rate minus rest) against the frozen arm. The network path **carries** when `feed` falls by
   ≥ 25 % of its naive value and the frozen arm's change is within its seed spread.
3. **Fallback rule (W16), off by default.** `flies.body.learning: { feed: true, stay: true }`. When on, with `ℓ` the
   learned valence of the dominant food pair (the larger mean input) while the fly stands on food:
   - `feed`: eat when `drive(feed)·ℓ ≥ feedThreshold`;
   - `stay`: walking speed on and within `food.reach` of a flower is scaled by `(2 − ℓ)`. A disliked flower (ℓ < 1)
     makes the fly walk on faster; a liked one (ℓ > 1) slower.

   It reads only decoded signals (`ℓ` comes from MBON spikes), runs identically in every arm, and is declared in
   data. ADR 011 records the probe result and which path is used. Results always state it.

**Rationale.** The user chose network first. The probe gives a number to decide on instead of a guess. The fallback
acts on exactly the two decisions the spec targets (eat and stay) and leaves steering to D34's `v_p` scaling.

**Alternatives.** Learned valence from `wmod` directly: rejected, because it reads synapses, not neurons, and the
decoder must read neurons (Principle VI). Read in the worker: rejected, because decoding lives on the main thread
(ADR 010 D28).

## §8 Experiments: conditioning, behaviour, arms, decay

**Conditioning probe** (`scripts/mb-conditioning-probe.mjs`, brain-only):
- naive test (A and B, 5 presentations each, valence read as in §7);
- 6 pairings of A, 100 ticks each, with the teaching pair (reward or punish) on during ticks 50–100;
- a test right after;
- a rest of `tauForget` steps;
- a test again.

Learned-valence shift = test − naive. Arms: plastic, frozen (`plasticity: null`), shuffled (`dopamine:
"shuffled"`) and the matched random graph (the C2-style rewire already used as RG in spec 017, with the same
sidecar groups by index). Pass (SC-002): A's shift has the right sign and is larger than B's, in ≥ 80 % of held-out
seeds; frozen and shuffled do this in ≤ 20 %.

**DAN-shuffled.** The core keeps a ring buffer of the last 4,000 steps of `D` per group. In shuffled mode it uses the
value at a lag drawn from the seeded stream every 200 steps (uniform in [1000, 4000]). The mean and distribution of
the teaching signal are kept, and its pairing with the odour is broken. This is deterministic.

**Behaviour experiment** (`scripts/learning-arms.mjs`, world `world-forager-learning.json`):
- Phases, declared in `experiment.schedule` (ticks): `pretest` 3000, `train` 6000, `posttest` 3000, `forget` = the
  ticks matching `tauForget`, then `decaytest` 3000. One simulated day is the `train` phase. The world has no
  day/night cycle (spec assumption).
- Scents per phase: both scents in tests. In training, scent B is punished (Story 3). The reversed schedule
  (A punished) runs on a second map (Story 3 scenario 4, and the demo acceptance rule of two maps).
- Story 4: training with scent A flowers only.
- Per arm, per scent, per phase: visits, stay ticks per visit (median, bootstrap 95 % CI), eat fraction per visit
  (fraction of visits with ≥ 1 eating tick), choice ratio (B visits / all visits). Built from `metrics.js` patterns:
  `stayMedian` exists, and `eatFraction` and `visitsByScent` are added.
- Calibration seeds `experiment.seeds` for tuning, held-out `experiment.heldOut` for verdicts (AGENTS rule).
- Results: `specs/019-mb-valence-learning/results.md` and `results.json`.

**Two maps.** The sketch map and the tilemap (as in spec 017), with one calibration: the constitution's demo
acceptance for the new brain.

**Rationale.** These are the four arms the user named, held-out verdicts, and stay/eat as the primary measures. A
lag shuffle is the standard way to break contingency while keeping rate statistics.

**Alternatives.** Shuffle by permuting DAN spikes across neurons: rejected, because pairing in time is what must be
broken, not identity. "One simulated day" as a fixed number of real seconds: rejected, because ticks are the
simulation's unit and are seed-stable.

## §9 Telemetry and panel

**Decision.**
- The worker adds an optional `learning: Float32Array(4)` field to the protocol-3 `motor` message
  (`dReward, dPunish, wmodApproach, wmodAvoid`), present only when plasticity is on and transferred.
- The decoder adds `ℓ_p` per food pair.
- The panel (D31 section) adds a "Learning" block: per-odour learned gain and declared valence ("approach × 0.72,
  learned"), dopamine drive per pool, mean `wmod` per MBON group, and an **injected** tag on each driven
  reinforcement pair. With learning off it shows "learning off".

**Rationale.** FR-021/022 and Principle V's telemetry rule. The protocol's version check rejects only unknown
versions and `left`/`right` keys, and readers ignore unknown fields, so an optional field is compatible. It is
documented as a protocol-3 addition, with contract tests on both sides (AGENTS "Contracts").

**Alternatives.** Send the full `wmod` array: rejected, because 33K floats per tick is pointless for a panel. A
protocol v4 bump: rejected, because nothing incompatible changes.

## §10 Governance order

1. `/speckit-constitution`: Principle VI, the valence bullet becomes "declared sign; its strength MAY be scaled by
   learning within bounds a decision record sets; shown as declared plus learned gain". This is a MINOR change, to
   v2.2.0. Principle V's plasticity bullet already covers L12, so it is unchanged.
2. ADR 011 `adrs/011-mb-valence-learning.md`: groups, L11, L12, the teaching sources, W16, and the gate results as
   they come in. Status "Proposed" until the regime gate passes.
3. The regime gate (§2) runs **before** any of §5–§9 is written (FR-008). If it fails after §3, ADR 011 records the
   finding and the feature stops (spec Story 1, scenario 5).
