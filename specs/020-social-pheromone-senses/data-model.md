# Data Model: Social and Pheromone Senses

The entities from [spec.md](spec.md) Key Entities, with their fields, validation and where they live. The contracts
in [contracts/](contracts/) are the binding shapes.

## Social sense (snapshot channel pair)

| Field | Value |
|---|---|
| `pair` | `odour-conspecific` \| `contact-pheromone` |
| channels | `<pair>-left`, `<pair>-right`; `side` L/R; `range` [0, 1] |
| `sense` | `odour:conspecific` \| `contact:pheromone` |
| `site` | `antenna` \| `front-leg` |
| neurons | resolved by the dataset filter (research R1); every neuron keeps `bodyId`, `type`, `class`, `superclass` |

Validation:
- Each side's pool is non-empty, or the extractor raises `E-SENSORY-NONE`.
- No `bodyId` is in two input pools, or it raises `E-POOL-OVERLAP` (R3).
- `sideMatch` is true for both pairs.
- Neurons with unknown side are dropped and counted in the extraction report.

## Social seed

A seed filter `{ "types": [...] }` or `{ "typePrefixes": [...] }`. Each filter must match at least one admitted body,
or `E-SEED-EMPTY` is raised. Each entry of `types` must match at least one body, or `E-SEED-EMPTY` names it. Bodies
added this way have `origin: "seed:type"`.

## Song output

`outputs.song = { types: ["pIP10"], drive: "song" }`. It is a sink like every output. The channel declaration v6 allows
`drive: "song"` at most once.

## Sex tag

| Field | Where | Rule |
|---|---|---|
| `flies.sex[i]` | world | `"female"` \| `"male"` \| absent (takes `flies.sexes.default`) |
| `flies.sexes.default` | world | a declared sex |
| `flies.sexes.<sex>.emits` | world | `{ <sense>: strength ∈ [0, 1] }`; each key must be a `from: "flies"` stimulus |

The tag sets the fly's sprite family (`fly-<sex>`, already in use) and its emission. It never selects a brain,
decoder or body layer.

## Conspecific table (per tick, runtime)

`env.conspecifics: [{ id, x, y, heading, sex, alive }]`. The host or the runner refreshes it once a tick before any
fly senses. It is read only by the `from: "flies"` sampler and the overlay, never by the body layer.

## Conspecific odour field

`odour(at, self) = min(1, Σ_{j ≠ self, alive} falloff(|at − p_j|, radius) × emits_j["odour:conspecific"])`. It is
sampled at each antenna site. `contrast` applies afterwards if declared. The overlay is the same function at cell
centres, with no `self`.

## Contact

`contact(at, self) = max_{j ≠ self, alive} [ |at − p_j| ≤ bodyRadius ] × emits_j["contact:pheromone"]`. It is sampled
at each front-leg site.

A **contact event** is a maximal run of ticks in which either front-leg site of fly i lies in some fly j's body. It
records `{ fly, other, otherSex, side, start, end }`. Side is L, R or both, whichever was first.

## Solid body (optional)

With `flies.body.solid: true`, a step that would bring the distance between two body centres below `2 × bodyRadius`
is refused, as a blocked cell is. Touch (`from: "blocked"`) also returns 1 when its site lies in another body.

## Decoder additions

- `pools["drive.odour-conspecific"]`, `pools["drive.contact-pheromone"]`, and optionally `pools["side.<pair>.L/R"]`.
  They are chosen by D27 with the social pairs among the conditions.
- `pools.song` holds the named pool's indices. Its rest comes from `homeostasis` (D33).
- `valence[<pair>]` is `approach` \| `avoid` \| `none`. It is set from the claims (R7) and copied from ADR 012.

## Song state (body layer, W17)

`fly.bodyLayer.song` is an integrator, `song ← song + (max(0, r(song) − rest) − song) / songTau`. While
`song ≥ songThreshold`, `fly.singing` is true. A **song bout** is a maximal run of singing ticks. The renderer
reads `fly.singing` and draws one wing extended. Nothing in locomotion reads it.

## Experiment arm

| Arm | Snapshot | Decoder |
|---|---|---|
| `social` | `forager-brain-social.brain` | its C2 decoder |
| `ablated` | the same snapshot after `lesion()`: out-edges of the social input pools set to weight 0 | the same decoder |
| `random-graph` | `rewire()` of the social snapshot | its own C2 decoder (same rule) |
| `random-walk` | no brain | none |

Every arm uses the same body-layer config object, the same spawn, the same world physics and the same conspecific
table rules.

## Social metrics (per fly, then over seeds)

`nnMedian`, `timeNear` (≤ 2 tiles), `contactRate` (per minute), `contactDuration`, `followingIndex`,
`songPerContact`, `songPerTickAlone`. Each also exists split by the other fly's sex. 95 % CIs come from
`bootstrapCI` over seeds. Definitions are in research R14.

## State transitions

```text
fly near/far:   far ──NN ≤ 2 tiles──▶ near ──NN > 2 tiles──▶ far
contact:        none ──leg site in body j──▶ contact(j) ──no leg site in any body──▶ none   (event closes)
song:           quiet ──song ≥ threshold──▶ singing ──song < threshold──▶ quiet           (bout closes)
```
