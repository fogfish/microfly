# Data Model: Brain Point-Cloud Inspector

**Feature**: `004-brain-point-cloud-inspector` | From [spec.md](spec.md) Key Entities, with the decisions in [research.md](research.md).

## 1. Brain Snapshot (container header, format version 2)

Unchanged fields: `provenance`, `synapseCap`, `neuronCount`, `edgeCount`, `neurons`, `sections`. Additions are optional and documented in [contracts/snapshot-header-additions.md](contracts/snapshot-header-additions.md).

| Field | Type | Rule |
|---|---|---|
| `provenance.positionSource` | string (new, optional) | Names the dataset file and column the soma positions came from. Present when `soma` is written. |
| `neurons[i].soma` | `[int, int, int]` or `null` (new, optional) | Voxel coordinates from `somaLocation`. `null` when the dataset has none. |
| `neurons[i].superclass` | string or `null` (new, optional) | The dataset `superclass`, `null` when unassigned. |

Existing neuron fields are unchanged: `index`, `role`, `bodyId`, `class`, `type`, `somaSide`, `transmitter`, `transmitterConfidence`, `sign`.

**Invariants**:
- `neurons[i].index == i`; roles of indices 0, 1, 2 are `sensory`, `left`, `right` (existing rule).
- If `soma` is an array, it has exactly three integers. Otherwise it is `null`.
- The same config and dataset give the same header, except `createdAt` (existing rule, now covering `soma` and `superclass`).

## 2. Extraction Report (CLI output)

New line in the report, after `edges`:

| Line | Content |
|---|---|
| `positions` | `N with soma, M without` (counts over the selected neurons) |

## 3. Brain Manifest Entry (`public/brains/brains.json`)

| Field | Type | Rule |
|---|---|---|
| `file` | string | File name in `public/brains/`. Must parse as a snapshot. |
| `label` | string | Human name shown in the switcher. |

## 4. Region (derived, viewer)

Derived from `superclass` by the prefix rule in research R4. Not stored.

| Region | Source superclass |
|---|---|
| Optic lobe | `ol_*`, `visual_*` |
| Central brain | `cb_*` |
| Ventral nerve cord | `vnc_*` |
| Brain-VNC pathways | `ascending_neuron`, `descending_neuron` (and `_tbc`), `sensory_ascending`, `sensory_descending`, `efferent_ascending`, `efferent_descending` (and `_tbc`) |
| ENS | `ENS` |
| Unannotated | `null`, or any superclass not matched above |

## 5. Group (derived, viewer)

One per distinct value of the chosen level among drawable neurons.

| Field | Meaning |
|---|---|
| `level` | `region`, `superclass`, `class` or `type` |
| `name` | The value. A neuron with a class missing but a superclass present is named `(no class) <superclass>` at the class level. Neurons with no value at a level are `Unannotated` (region, superclass) or `Untyped` (type). |
| `members` | Indices of neurons in the group (only those with `soma`). |
| `count` | Number of members. |
| `centroid` | Mean of member positions, or placed from neighbours (research R6). |
| `colour` | From the reference palette for region; hashed hue for other levels (reference rule). |

## 6. Group Edge (derived, viewer)

| Field | Meaning |
|---|---|
| `source`, `target` | Group names at the chosen level. |
| `synapses` | Sum of raw synapse counts of body edges between members. Self-pairs are not drawn in group mode. |

## 7. Body Edge (from the snapshot)

Read from the CSR arrays: `source` = the neuron whose `offsets` range holds the edge, `target` = `targets[k]`, `synapses` = `synapses[k]` (raw count), `weight` = `weights[k]`.

## 8. Viewer State (not persisted)

| Field | Default | Notes |
|---|---|---|
| `brain` | the first manifest entry, or `?brain=` | File name |
| `level` | `class` | Matches the reference default |
| `mode` | `group` | `group` or `body` |
| `minSynapses` | 1 | Log-scaled slider, as the reference |
| `topEdges` | 300 | Body mode; slider up to 3,000 |
| `hidden` | per level; `type` hides "Other typed" and "Untyped" | Legend checkboxes |
| `showPoints` | true | Soma points |
| `showUnannotated` | false | Reference default |
| `autoRotate` | false | |
| `density` | 100% | Stable random rank per neuron, as the reference, so lower density keeps a stable subset |

## Validation rules (viewer)

- A brain that fails the reader's checks shows the error panel with the reader's message and draws nothing.
- A brain with no neuron that has `soma` shows an empty view with the message "no neuron has a 3D position".
- A malformed `soma` makes the whole file fail (research R11), so a partial view is never drawn.
