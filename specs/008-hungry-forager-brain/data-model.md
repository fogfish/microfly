# Data Model: Hungry Forager Brain

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Entities from the spec's Key Entities section, with their fields, the rules that hold them, and the state they
change. Field names are the JSON and JavaScript names; the Python side uses the same names in the header.

## 1. Brain choice (world config)

Read from `flies.brain` in a world file. Chooses the whole brain stack.

| Field | Type | Rule |
|---|---|---|
| `version` | `"mock" \| "v0" \| "v1"` | Optional. Absent → `mock` if no `snapshot`, else `v0` (spec FR-002). |
| `snapshot` | string (path) | Required for `v0` and `v1`; forbidden for `mock`. |
| `neuronCount`, `outDegree`, `inhibitoryFraction` | number | Mock only (existing rules). |
| `motorSmoothing` | number in (0, 1] | v0 and mock. For v1 the EMA is per LIF step (ADR 003 L5). |
| `lif` | object | Keys must belong to the chosen version's defaults (`LIF_DEFAULTS` for v0, `LIF_V1_DEFAULTS` for v1). |
| `stepsPerTick` | integer 1–20 | v1 only. Default 1. |

**Resolved version** is one of `mock`, `v0`, `v1`. It decides the LIF module, the runner, the protocol version and the
snapshot reader. The pair (`version`, container version of `snapshot`) must be (`v0`, 3) or (`v1`, 4), or the world does
not start (spec FR-003).

## 2. Brain container (snapshot), versions 3 and 4

Binary layout is the same for both: `MFBR`, format version (uint32), header length (uint32, multiple of 8), UTF-8 JSON
header padded with spaces, then the CSR sections `offsets`, `targets`, `weights`, `synapses`. Only the header differs.

### Version 3 (ADR 002 small brain)

Unchanged. Roles `sensory`, `left`, `right` at indices 0–2; one input on neuron 0; drives `left`, `right`.

### Version 4 (ADR 003 forager brain)

Header fields:

| Field | Type | Rule |
|---|---|---|
| `provenance` | object | As v3: `datasetRelease`, `edgeVariant`, `minConfidence`, `configHash`, `toolVersion`, `createdAt`, `positionSource`. |
| `kind` | `"forager"` | Selects the drive set (see channel declaration v4). |
| `synapseCap` | integer | Kept for the record. Not used by `postFraction` weights. |
| `weightRule` | `"postFraction"` | Weights are `sign × synapses / Σ synapses into the target`. |
| `neuronCount`, `edgeCount` | integer | Must match the arrays. |
| `neurons` | array | One entry per neuron, index order below. |
| `capabilities` | object | Channel declaration v4 (see contract). |
| `modulators` | array | ADR 003 D5: `{id, label, range, targets, gain: [g0, g1]}` or `{id, source, targets, gain}`. |
| `sections` | object | Byte offsets, as v3. |

**Neuron entry (v4)**: `index`, `role` (`input` | `output` | `interneuron`), `channel` (the id of the input or
output that the neuron belongs to, `null` for interneurons), `bodyId`, `class`, `type`, `somaSide`, `superclass`,
`soma`, `transmitter`, `transmitterConfidence`, `sign`, `flowInput` and `flowOutput` (the scores that selected
the neuron; `null` for pool neurons).

**Index order** (ADR 003 W5): input pools in channel declaration order, output pools in declaration order, then
interneurons by ascending `bodyId`. Within a pool, neurons are in ascending `bodyId`.

**Invariants**:
- `neurons[i].index === i`; roles of the first `Σ pool sizes` entries are `input` or `output` as listed.
- `targets[k] < neuronCount`; `synapses[k] ≥ 1`; `weights` finite.
- An output neuron with `sign: 0` has no outgoing edge (ADR 003 D2).
- Every output pool has at least one incoming edge (`E-OUTPUT-UNREACHED`).

## 3. Channel declaration

Shared by the panel, the inspector and the body. Lives in the brain container header (or the world config for mock).

- **v3 channel** (existing): `{id, label, side, neuron, range, drive?}`.
- **v4 channel**: `{id, label, side, neurons, range, drive?}`. Input channels have no `drive`. Output channels of a
  forager have one of `turnLeft`, `turnRight`, `forward`, `backward`, `feed`; a tank has `left` or `right`.
- Ids match `^[a-z][a-z0-9-]*$` and are unique across inputs and outputs. The v4 forager's ids are `odour-left`,
  `odour-right`, `taste-left`, `taste-right` (inputs) and `turn-left`, `turn-right`, `forward`, `backward`, `feed`
  (outputs).

## 4. Fly state (host)

Per fly, held by the host (`FlyRecord.state`).

| Field | Type | Rule |
|---|---|---|
| `id`, `mode`, `sprite`, `brainSeed` | as today | Unchanged. |
| `body` | `{x, y, heading, cell, contacts}` | Unchanged for v0. For v1, `contacts` is still counted but does not decide the verdict (spec FR-028). |
| `energy` | number in [0, 1] | New (v1 only). Starts at `body.energy.initial`. |
| `hunger` | number in [0, 1] | Derived: `1 − energy`. Sent to the worker as `state.hunger`. |
| `eating` | boolean | True on a tick where the fly ate. |
| `bout` | `{cell, ticks, endedBy}` or null | The current eating bout, closed by `endedBy` ∈ `empty`, `walked`, `sated`. |
| `tick` | integer | Unchanged. |

## 5. Food (world)

Per flower, held by the host in `food.js`.

| Field | Type | Rule |
|---|---|---|
| `cell` | `{cx, cy}` | Fixed at world build (from `stimulusCells`). |
| `stock` | number in [0, `food.stock`] | Starts full. Lowered by `consume` while a fly eats it, raised by `regrow`. |
| `kind` | string | The edible kind, as today (`flower`). |

**Transitions**:
- `consume(cx, cy, amount)`: `stock ← max(0, stock − amount)`. Called once per eating tick with `amount = consumeRate × dt`.
- `regrow(seconds)`: `stock ← min(full, stock + regrowth × seconds)`, once per tick for every flower.
- Empty flower (`stock = 0`): gives no taste and no odour (spec FR-024).

## 6. Energy and eating (body rules)

Pure functions in `energy.js`.

- `metabolise(energy, dt, metabolism)`: `energy ← max(0, energy − metabolism × dt)`.
- `eat(energy, dt, intake)`: `energy ← min(1, energy + intake × dt)`.
- `canEat({ stock, speed, feed }, cfg)`: true only when `stock > 0`, `speed < food.eatSpeed` and
  `feed > food.feedThreshold` (spec FR-023).
- Energy at 0 does not stop the fly (out of scope; spec edge case).

**Bout rule**: a bout starts on the first eating tick on a cell, ends on the first tick without eating. Its end
is `empty` if the stock is 0, `sated` if `feed` fell below the threshold and energy is at least `sated` (default 0.9),
else `walked` (the fly moved off while the flower still had stock). The experiment counts `walked` for metric 4.

## 7. Input values and drive values (per tick)

- **Sense (host → worker, protocol v3)**: `inputs: Float32Array` (one value per declared input, in declaration order:
  `odour-left`, `odour-right`, `taste-left`, `taste-right`), `state: {hunger}`.
- **Motor (worker → host)**: `outputs: Float32Array` (one per declared output, in declaration order), `spikes:
  Uint32Array`. `left` and `right` are present only for tank brains.
- **History entry (host, panel)**: `{tick, inputs, outputs, spikes, action}`. `action` is the label derived from the
  drives. `left` and `right` stay for tank brains and the v0 panel.

## 8. Experiment record

One row per arm × seed. Written to stdout as a table and to the run's JSON.

| Field | Meaning |
|---|---|
| `arm` | `mock`, `v0`, `v1`, `random-matched`, `baseline`. |
| `seed` | Held-out seed. |
| `found` | Flies that reached a flower within the run (metric 1). |
| `approachTicks` | Ticks to the first flower, for flies that started beyond one odour radius (metric 2). |
| `boutLengths` | Eating bout lengths in ticks (metric 3). |
| `walkedShare` | Share of bouts with `endedBy = walked` (metric 4). |
| `findRateHungry`, `findRateSated` | Flower-finding rate for `energy 0.1` and `energy 0.9` starts (metric 5). |
| `contacts` | Contact count, printed only (spec FR-028). |
| `tickMs` | Mean and p95 wall time per tick for the arm, when run in the browser harness. |

## Relationships

- A **world** holds flowers (food) and a `flies` section with one brain choice.
- A **brain choice** names one **snapshot** (for v0 and v1). The snapshot's channel declaration drives the **panel**
  rows and the **body** drives.
- A **fly** has one **worker** (protocol v3 for v1, v2 otherwise), reads its **inputs** from the **world**, and
  changes the world only through eating (consumes a flower's stock).
