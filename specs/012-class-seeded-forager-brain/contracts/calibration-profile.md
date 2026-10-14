# Contract: Calibration profile shape (`.claude/skills/microfly-calibrate/scripts/profiles/*.mjs`)

**Owner**: `scripts/engine.mjs` and `scripts/calibrate.mjs` (the ported, generic microfly-calibrate skill) consume;
each `profiles/<id>.mjs` implements. First formalised here because this feature adds the first new profile since
the skill was ported back from branch `013-forager-brain-15k-lif-v2`; `profiles/v1.mjs` (ported unchanged) is the
existing, known-good instance this contract is extracted from.

## Why this is a contract now

The skill's own `SKILL.md` already documents the shape informally ("Extending to a new brain version: copy
`scripts/profiles/v2.mjs`... read an existing profile as the spec for the next one"). This feature adds a second
profile (`class-seed-11k.mjs`) and removes the one (`v2.mjs`) that text pointed at, so the shape is written down
explicitly rather than left to "read the other file."

## Shape

```ts
export const profile = {
  id: string,                 // CLI --version=<id> selector; NOT the same axis as container/protocol "version"
  label: string,               // human-readable, shown in reports
  worldPath: string,            // relative to public/, the world config this profile calibrates
  brainVersion: 'v0' | 'v1' | 'v2', // flies.brain.version this profile's world/snapshot pair declares (FR-001 values only)
  armName?: string,              // scripts/forager-arms.mjs's stage=world dispatch key (default: brainVersion --
                                  // only needed when brainVersion is not itself a recognised arm name, e.g. "v2")

  prepareContext(ctx): void,              // per-run bookkeeping stashed on ctx (world, snapshot, capabilities already loaded)
  regionNames: string[],                   // gate-able regions; ["all"] for a brain with no per-neuron group
  regionFractions(spikes, ctx): Record<string, number>,
  appliedScale(net, neuronIndex): number,  // the effective synaptic scale engine.mjs reports for a neuron

  axes: Record<string, unknown[]>,         // the A1 grid; each key a LIF/runner parameter name or paired tuple
  scaleAxis: string,                        // which axis key is the primary excitability scale
  referencePoint(): Record<string, unknown>, // the single point `classify`'s phase-0 scan starts from
  groupGainAxisFor(stuckRegions: string[]): unknown[] | null,  // null when the brain has no per-region gain to widen

  gates: {
    restFloor: number, restCeiling: number,
    floorGroups?: string[], ceilingExemptGroups?: string[], rateBasis?: 'union' | 'perStep',
    odourGroups: string[], odourGain: number, lateralMin?: number,
    settleGroups?: string[], settleCondition?: string, neighbours: number, requireFeed?: boolean,
  },

  brainOf(point): object,                   // grid point -> world config's `flies.brain.lif`/`stepsPerTick` overrides
  conditions(point, ctx): Record<string, Float32Array>,  // named probe input vectors (rest/odour/left/right/taste/...)

  readoutScales: number[],                   // A2's outputScale search ladder
  restDriveMax?: number,                      // optional: bounds |rest.forward| when fitting the forward gain
  fitReadout(runs, forwardTarget, ctx): { outputScale, drives, restOk? },

  odourRadius(f): number,                     // reads the fly config's odour reach for this profile's world

  estimateRegimePointMs(point?): number,      // cost model for calibrate.mjs's --budget-minutes check
  estimateWorldCandidateMs(seedCount, ticks): number,
};
```

- `engine.mjs` calls every member above; `calibrate.mjs` only reads `id`/`label`/`worldPath`/`brainVersion` and
  the cost-model functions directly (the rest flows through `engine.mjs`).
- A profile with no per-neuron `group` field (this feature's brain, and `v1.mjs`) sets `regionNames: ['all']`,
  a constant `regionFractions`, and `groupGainAxisFor` returning `null` unconditionally — `classify` then finds
  nothing to widen, which is correct, not a missing feature.
- `conditions` MUST read channels generically from `ctx.capabilities.channels` (by `id`/`sense`/`side`), never by
  a hard-coded position, so a future channel re-declaration cannot silently misalign the probe (the lesson
  `v2.mjs` already recorded against `v1.mjs`'s original, position-based version — carried forward here, not
  reintroduced).

## `class-seed-11k.mjs` (this feature's new profile)

| Field | Value / shape |
|---|---|
| `id` | `"class-seed-11k"` |
| `worldPath` | `"world/world-forager-11k.json"` |
| `brainVersion` | `"v1"` |
| `regionNames` | `["all"]` (no per-neuron `group` field on this brain — see `container-v4-additions.md`) |
| `referencePoint()` | v1's calibrated LIF block (ADR 006 Calibration protocol point 2) |
| `axes` | v1's grid (`synapticScale`, `noise`, `stimulus`) **widened** with `inhibitoryScale`, `adapt` (`[tauAdapt, adaptStep]` pair), `thresholdJitter` (ADR 006 Calibration protocol point 3, branch 013 BUG-002/BUG-003) |
| `gates` | `ceilingExemptGroups: ['output']`, `rateBasis: 'perStep'` (BUG-002 corrections), rest otherwise as `v1.mjs` |
| World stage | run with `--top=3` so more than one `forwardTarget` × `motorSmoothing` operating point is tried (ADR 006 Calibration protocol point 4) |

## Compatibility

- `v1.mjs` is ported unchanged and keeps working as `--version=v1` (the engine's known-answer case). Adding
  `class-seed-11k.mjs` does not modify `engine.mjs`, `calibrate.mjs`, or `v1.mjs`.
- `v2.mjs` is not ported (research.md §6); a future brain generation that *does* introduce a per-neuron `group`
  field writes its own profile against `v2.mjs`'s shape as recorded on branch 013, not against this one, since
  `regionNames`/`regionFractions`/`groupGainAxisFor` only make sense non-trivially once a `group` field exists.

## Contract test

`tests/calibrate-engine.test.mjs` (ported unchanged from branch 013) already exercises `engine.mjs`'s pure gate
functions (`perStepRateFromUnion`, `rescoreStoredRow`) against a synthetic profile fixture shaped like the table
above — it is the existing test for this contract's gate logic. No test asserts the CLI's end-to-end output
against a live brain (that is what running the skill interactively is for, per `SKILL.md`'s own "report, don't
adopt" step).
