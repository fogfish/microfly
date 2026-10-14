# Data Model: Wide-I/O Forager Brain (Brain v2)

Entities this feature adds or extends. Each names where it is read/written in the extractor (Python) and the
simulator (JS), and which existing entity it extends. Full field rules are in `contracts/`.

## Extraction-side entities

### ExtractionConfig (format 5, `kind: "forager-wide"`)

Extends the format-4 `classSeed` `ExtractionConfig` (specs/012 data-model.md). Reuses verbatim: `datasetRelease`,
`edgeVariant`, `expect`, `admission`, `transmitterColumn`, `transmitterSign`, `defaultSign`, `minSynapses`, `seeds`,
`fill`, `weightRule`, `neuronCountRange` (ADR 007 D18). New or changed:

| Field | Type | Notes |
|---|---|---|
| `formatVersion` | `5` | Dispatch discriminator, with `kind` and `selection` (contracts/extract-config-forager-wide.md). |
| `inputs[cid].pair` | string | New, optional. Groups channels for side matching and for fidelity checks (R5). Absent in format 4. |
| `inputs[cid].entryNerves` | string[] | New, optional filter (R6). A body matches only if its `entryNerve` is in this list. |
| `inputs[cid].excludeReceptorTypes` | string[] | New, optional filter (R6). A body is excluded if its `receptorType` is in this list. |
| `sideMatch` | `{ [pair]: boolean }` | Keyed by `pair` in format 5 (was keyed by pathway name `odour`/`taste` in format 4). |
| `outputs.escape` | `{ types: ["DNp01"], drive: "escape" }` | New output channel; declaring it drops `DNp01`'s outgoing edges (ADR 003 D2's rule, applied to a new output). |
| `fidelity.checks` | `FidelityCheck[]` | New, replaces the format-4 fixed two-check probe (D19). |

### InputChannelSpec / OutputChannelSpec

Extends the existing per-channel filter spec (`class`, `rootSide`, `types`/`subclasses`/`typePrefixes`) with the
three new optional keys above. An input spec with none of them behaves exactly as a format-4 spec.

### SideMatchedPair

A declared `pair` name (`"odour-food"`, `"odour-danger"`, `"heat"`, `"taste-mouth"`, `"taste-leg"`, `"touch"`) that
groups exactly two input channel ids (one `rootSide: "L"`, one `"R"`). Side matching for a pair whose `sideMatch`
entry is `true` keeps, per shared `type`, `min(|L|, |R|)` bodies on each side (unchanged rule, generalised grouping,
R5). A pair matched to anything other than exactly one L and one R channel is `E-PAIR`.

### FidelityCheck

One declared gate in `fidelity.checks`:

| Field | Type | Notes |
|---|---|---|
| `kind` | `"contrast"` \| `"sign"` | |
| `pair` | string (contrast only) | The pair whose L/R split is checked against `turn-left`/`turn-right`. |
| `from` | string (sign only) | The pair whose merged L+R pool is checked. |
| `to` | string (sign only) | The output id the pool's mean is checked against. |
| `minFraction` | number (contrast only) | As format 4's `minContrastFraction`, per check instead of global. |

### FidelityReport (generalised)

Extends the format-4 `FidelityReport` (specs/012 data-model.md). `table` now has one entry per **individual**
declared input channel id (twelve rows) × every declared output (six columns) — not per merged pool — each with
`{ brain, wholeGraph }` propagated values (R7). `checks` holds one result per declared `FidelityCheck`, each with
`{ pass, ...the check's own compared values }`. `require` (unchanged meaning) still stops extraction with
`E-FIDELITY` when `true` and any check fails; a `false`/unlisted pair is still computed and stored, never hidden
(ADR 007 D19).

## Simulator-side entities

### ChannelDeclaration v5 (`kind: "forager-wide"` only)

Extends v4 (`neurons`, `label`, `side`, `range`, `drive`). New, required for every input under this kind:

| Field | Type | Notes |
|---|---|---|
| `sense` | string | e.g. `"odour:food"`, `"odour:danger"`, `"heat"`, `"taste"`, `"touch"`. Looked up in the world's `flies.stimuli`. |
| `site` | string | e.g. `"antenna"`, `"mouth"`, `"front-leg"`. Looked up in the world's `flies.body.sites`. |

Outputs under this kind carry exactly six drives: `turnLeft`, `turnRight`, `forward`, `backward`, `feed`, `escape`
(`KIND_DRIVES["forager-wide"]`). A `kind: "forager"` declaration is unaffected (still v4: no `sense`/`site`, five
drives).

### StimulusDeclaration (world config, `flies.stimuli`)

One entry per distinct `sense` value a `forager-wide` snapshot declares:

| Field | Type | Notes |
|---|---|---|
| `from` | `"edibles"` \| `"dangers"` | Which world object list the sense reads. |
| `kinds` | string[] (optional) | Restricts `from: "dangers"` to e.g. `["spider"]` (danger odour) or `["lantern"]` (heat). Absent means every kind of that list. |
| `scaleBy` | `"stock"` (optional) | For `edibles`-sourced senses: scale by the object's remaining stock, as food odour and taste already do. |
| `radius` | number (optional) | Falloff radius in tiles, for a distance sense. |
| `contact` | boolean (optional) | `true` for a sense read only on the body site's own cell (taste, touch), with no falloff. |

A `sense` a snapshot declares with no matching `flies.stimuli` entry is a world load error (FR-018), not a silent
zero — the same strictness the project already applies to version mismatches.

### BodySite (world config, `flies.body.sites`)

One entry per distinct `site` value a `forager-wide` snapshot declares:

| Field | Type | Notes |
|---|---|---|
| `forward` | number | Offset ahead of the body centre, along the heading, in tiles. `0` for `antenna`/`mouth`; `0.5` for `front-leg` (ADR 007 W9). |
| `lateral` | number | Offset across the heading, in tiles, before mirroring for the channel's declared `side`. `0` for `mouth` (ADR 007 W8: both `taste-mouth` channels read the same value, by design). |

### EscapeConfig (world config, `flies.body.escape`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `enabled` | boolean | `false` | ADR 007 W10/D17: off by default; the drive is still computed, shown and logged. |
| `threshold` | number | `0.5` | Drive value above which an escape move is triggered. |
| `distance` | number | `1.5` | Tiles moved along the heading on a triggered escape. |
| `cooldown` | number | `2` (seconds) | Minimum time between two triggered escapes. |

### EscapeState (per-fly runtime state, not config)

Added to the forager fly state alongside `energy`/`bout`/`bouts` (`initForagerFly`): a cooldown timer (seconds
remaining until the next escape may trigger), reset to `0` at spawn and to `cooldown` on every triggered escape.
Irrelevant and untouched for any brain whose declaration has no `escape` output.

### BrainVersionEntry (`fly-brain.js` dispatch table, conceptual — not a stored structure)

| `brain.version` | Runner | Expected container `kind` | Sensing | Notes |
|---|---|---|---|---|
| `mock` | v0 | — (no snapshot) | n/a | unchanged |
| `v0` | v0 | — (no `kind`, version 3) | n/a | unchanged |
| `v1` | v1 (`fly-brain-v1.js`) | `"forager"` | `forager-step.js` (hard-coded 4 channels) | unchanged |
| `v2` | v1 (`fly-brain-v1.js`, same code) | `"forager-wide"` | `forager-step-wide.js` (declared sense/site) | new |

## Relationships

```text
ExtractionConfig (format 5)
  ├─ inputs[cid] : InputChannelSpec ──(pair)──> SideMatchedPair ──(sideMatch[pair])──> side matching rule
  ├─ outputs[cid]: OutputChannelSpec (escape added)
  ├─ fidelity.checks[] : FidelityCheck ──(pair | from/to)──> references inputs[cid].pair / outputs[cid]
  └─ capabilities.channels : ChannelDeclaration v5 (inputs carry sense/site; outputs carry 6 drives)
         │ (written into the snapshot header)
         ▼
Snapshot (container v4, header kind "forager-wide")
         │ (read by)
         ▼
World config, flies.brain.version "v2"
  ├─ flies.stimuli[sense]   : StimulusDeclaration  ──┐
  ├─ flies.body.sites[site] : BodySite              ─┼──> forager-step-wide.js builds the 12-value sense message
  └─ flies.body.escape      : EscapeConfig          ──> body.js's escape step, gated, reads the escape drive
```
