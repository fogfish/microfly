# Contract: `learning-v1` (the mushroom-body learning sidecar)

**Owner**: `public/js/brain/learning.js` (reader and group resolver, new; pure, used by the worker and by Node
scripts). The file is hand-written and checked in, so there is no generated writer. **New contract**, ADR 011.
Applies only to `flies.brain.version: "v3"`.

## Location

`public/brains/<snapshot-basename>.learning.json`. The world names it with `flies.brain.learning` (a path resolved
like `flies.brain.snapshot`). The host fetches it and passes the parsed object in `init.brain.learning`.

## Shape

```json
{
  "format": "learning", "version": 1,
  "snapshot": { "file": "forager-brain-mb.brain", "sha256": "…" },
  "groups": {
    "kc":     { "class": "Kenyon_Cell" },
    "reward": { "class": "DAN", "typePrefixes": ["PAM"] },
    "punish": { "class": "DAN", "typePrefixes": ["PPL1"] }
  },
  "mbon": [
    { "type": "MBON01", "role": "avoid",    "cite": "Aso et al. 2014 eLife 3:e04580, Fig. 6" },
    { "type": "MBON11", "role": "approach", "cite": "Aso et al. 2014 eLife 3:e04580, Fig. 6" }
  ],
  "references": { "Aso2014b": "Aso Y, et al. (2014) Mushroom body output neurons encode valence and guide memory-based action selection in Drosophila. eLife 3:e04580" }
}
```

A group selector takes `class` (required) and either `types` or `typePrefixes` (optional), matched against the
manifest's `class` and `type`.

## Reader rules, in order

| Code                  | Rule                                                                   |
| --------------------- | ---------------------------------------------------------------------- |
| `E-LEARN-FORMAT`      | `format` is `"learning"` and `version` is `1`                          |
| `E-LEARN-SNAPSHOT`    | `snapshot.sha256` equals the loaded snapshot's                         |
| `E-LEARN-ROLE`        | each `mbon[].role` is `approach` or `avoid`; each `type` appears at most once |
| `E-LEARN-CITE`        | each `mbon[]` has a non-empty `cite`                                   |
| `E-LEARN-GROUP-EMPTY` | `kc`, `reward`, `punish`, `approach`, `avoid` each resolve to ≥ 1 neuron |

Each message names the file and the group or type.

## Resolution

`resolveLearningGroups(file, manifestNeurons)` returns `{ kc, reward, punish, approach, avoid, unlisted }`. Each is
a `Uint32Array` of neuron indices, ascending. `unlisted` holds the MBON types in the snapshot that have no entry,
for reports. The function is pure and deterministic.

## Addition to `decoder-v1` (optional key, compatible)

```json
"learning": { "naive": { "odour-food-a": 0.12, "odour-food-b": -0.03 }, "kValence": 2.0, "tau": 300 }
```

C2 writes `naive` (the MBON balance per food pair at the probe, before any learning) when the world names a learning
sidecar. A decoder file without `learning` falls back to measuring the naive balance in the first 300 ticks of
presence (data-model.md). The reader rejects a `naive` key that names no declared pair (the existing "unknown pair"
rule).

## Contract tests

- The reader: one test per code, on a synthetic manifest fixture.
- Resolution: ascending order; ties on `bodyId`; `unlisted` correct.
- The shipped `forager-brain-mb.learning.json` resolves against the shipped snapshot with every group non-empty
  (`npm test`).
