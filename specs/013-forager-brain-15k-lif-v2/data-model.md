# Phase 1 Data Model: Cautious Forager Brain (15K, LIF v2)

Entities new to this feature, and the existing entities they extend. Field-level rules are normative in
[contracts/](contracts/); this document states what each entity is and how its parts relate. ADR section
references are to [ADR 006](../../adrs/006-cautious-forager-brain-15k.md).

## Extraction config (format 4, kind `forager`)

A JSON file read by the Python extractor (`extract/configs/forager-brain-15k.json`). Declares everything D8–D13
need, nothing else. Distinct from the extraction config's sibling, format 3 (unchanged, produces container v4).

| Field | Meaning | Rule |
|---|---|---|
| `formatVersion` | `4` | Selects the format-4 schema in `config.py`. |
| `kind` | `"forager"` | Shared with format 3 (R2); container version, not `kind`, signals the generation. |
| `transmitterSign`, `minConfidence` | as today | Used by the `predicted_nt` tier of D10's fallback. |
| `transmitterSource` | ordered list of column names (D10) | First column, in order, naming a transmitter wins. Must name only columns the dataset provides (`E-TRANSMITTER-SOURCE` otherwise). |
| `inputs` | 12 named channels, each a pool filter + side rule (D8) | A body in two input pools is `E-POOL-OVERLAP`. |
| `outputs` | 6 named channels incl. `escape` (D9) | An output with no incoming edge is `E-OUTPUT-UNREACHED`. |
| `sideMatch` | per-channel-pair boolean (D8) | Declares which of the six senses are left/right matched. |
| `pathways` | names 6 input-channel pairs (D11) | Used as the rows of the pair-grid. |
| `outputGroups` | names 5 output groupings (turn/forward/backward/feed/escape, D11) | Used as the columns of the pair-grid. |
| `flowSteps` | integer (D11) | Hops for forward/backward flow. |
| `budget.perPair` | integer (D11) | Top-k candidates kept per (pathway, outputGroup) pair. A pair with none above a positive score is `E-PAIR-EMPTY`. |
| `anchors` | whole-class admission rules (D12) | A class matching no admitted body is `E-ANCHOR-EMPTY`. |
| `excludeInterneuronClasses`, `excludeInterneuronSuffix` | whole-class exclusion (D12) | Applied after the pair-grid union, before anchors are added. |
| `weightRule` | `"synapseCount"` (new) or `"postFraction"`/`"postFractionAbsolute"` (D13) | `synapseCount` is `sign(i) × synapses(i→j)`. |
| `minSynapses` | integer, default 1 (D13) | Edges below this are dropped before weights are computed. |
| `modulators` | as today, extended to the new input channels | Hunger gain on `odour-food`, `taste-mouth`, `taste-leg`. |
| `neuronCountRange` | `[12000, 18000]` | Self-check range; outside it is `E-NODE-RANGE`. |

## Brain container (version 5)

The binary snapshot format 4's selection and extraction produce (`public/brains/*.brain`). Extends container
version 4 (channels, roles, induced CSR graph, provenance) with:

| Field | Scope | Meaning |
|---|---|---|
| `channel.sense` | per input channel | Which declared sense it reads (e.g. `odour:danger`) — W6. |
| `channel.site` | per input channel | Which body site it is sensed at (e.g. `front-leg`) — W6. |
| `drive: "escape"` | one output channel | The sixth output; added to the drive vocabulary (`FORAGER_DRIVES_V2`). |
| `group` | per neuron | One of `input`/`output`/`al`/`vnc`/`dn`/`central` (L10's first-match rule); used by `groupGain` and the panel's region-activity section. |
| `transmitterSource` | per neuron | Which column (`ground_truth`/`consensus_nt`/`predicted_nt`) gave its sign (D10, Principle III traceability). |
| `weightRule: "synapseCount"` | header | New accepted value beside the existing two. |
| `minSynapses`, `anchors` | header | Recorded for provenance/report, not re-validated at load. |

Container versions 3 and 4 keep their existing readers unchanged (AGENTS.md: "old brains keep working").

## Sense declaration

Not a stored entity on its own — the link between a channel's `sense`/`site` (in the container) and the world
config's `flies.stimuli`/`flies.body.sites` (which world objects and offsets realise that sense). Six senses exist
for this brain: `odour:food`, `odour:danger`, `heat`, `taste:mouth`, `taste:leg`, `touch`. A snapshot declaring a
sense with no matching `flies.stimuli` entry is a world-start validation error (FR-021), not a silent zero.

## Region

A per-neuron grouping (`input`, `output`, `al`, `vnc`, `dn`, `central`), written at extraction time by the
first-match rule in L10. Used two ways: (1) `lif-v1.js`'s optional `groupGain` scales incoming edges per target
neuron's region; (2) the panel's region-activity section aggregates per-region spike activity over the same
rolling window the existing global activity count already uses.

## Escape event

Not persisted — a per-tick, per-fly transient: the `escape` output crosses its configured threshold, the fly is
not in cooldown, so `jumpForagerBody` moves it `distance` tiles along its heading (stopping at the first
non-walkable cell) and sets `escapeCooldownTicks` to the configured cooldown. The panel's action label and
diagnostic read this tick's outcome (jumped or not) from the fly's telemetry, the same way the existing `eating`
flag is read for the `feed` drive.

## Metric records (experiment script)

Five new pure metrics (`public/js/fly/metrics.js`), computed per arm over held-out seeds, alongside the unchanged
find/approach/eat/leave/hunger-dependence metrics:

| Metric | Computed from | Shape |
|---|---|---|
| Brake | forward drive on a flower ÷ off flowers, hungry flies | ratio, per arm |
| Avoid | fraction of ticks within 1.5 tiles of a spider / of a lantern | two fractions, signed, per arm |
| Touch | fraction of ticks with a blocked move | fraction, per arm |
| Escape | escape events per minute, near danger vs. away from it | two rates, per arm |
| Rest | activity per region with no stimulus | one fraction per region, per arm |

Each is reported for every arm (`mock`, `v0`, `v1`, `v2`, size-matched random graph, random walk); none of them is
a pass/fail gate except brake/eat, which the spec (SC-007) does require to improve on the random-graph arm.
