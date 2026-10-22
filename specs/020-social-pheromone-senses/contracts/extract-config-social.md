# Contract Amendment: extract config format 5, social additions

**Amends**: [extract-config-forager-wide.md](../../013-wide-io-forager-brain/contracts/extract-config-forager-wide.md)
and spec 019's pair overlap rule. Every key is optional. A format-5 config that sets none of them validates and
extracts byte-identically to before, so there is **no format bump**. Owners: `extract/malecns_brain/config.py`
(validation), `selection_class_seed.py` (selection), `capabilities.py` (declaration).

## 1. Seed filters by type

```json
"seeds": [
  { "class": ["ALPN", "ALLN", "ALIN", "ALON", "Kenyon_Cell", "MBON", "DAN"] },
  { "superclass": ["descending_neuron"] },
  { "typePrefixes": ["pC1_", "mAL4", "mAL5", "mAL6", "mAL_"] },
  { "types": ["AN09B017e", "AN09B017f", "AN09B017g", "pIP10"] },
  { "partnersOf": "outputs" }
]
```

- A filter holds exactly one of `class`, `superclass`, `types` or `typePrefixes`, and it must be a non-empty list of
  strings. Otherwise: `seeds[i] needs exactly one of class, superclass, types or typePrefixes`.
- Only admitted bodies match (`allTraced`).
- A filter that matches nothing raises `E-SEED-EMPTY`. So does each `types` entry that matches no body:
  `E-SEED-EMPTY: seeds[i].types "<name>" matches no admitted body`.
- Origin is `seed:type`, unless a class or superclass seed already tagged the body. The panel draws every `seed:*`
  origin as a seed.
- The fill exclusions (sensory, motor) do not apply to seeds, as for class seeds.

## 2. Input filter `receptorTypes`

```json
"contact-pheromone-left": {
  "pair": "contact-pheromone", "class": "gustatory", "subclasses": ["leg bristle"], "entryNerves": ["ProLN"],
  "receptorTypes": ["putative_ppk23", "putative_ppk25"], "rootSide": "L"
}
```

- `receptorTypes` keeps only bodies whose `receptorType` is in the list. If one input declares both `receptorTypes` and
  `excludeReceptorTypes`, validation fails with `E-CONFIG`.
- `odour-conspecific-left/right`: `class olfactory`, `types ["ORN_DA1", "ORN_VA1v", "ORN_VA1d"]`, `rootSide` L/R.

## 3. `E-POOL-OVERLAP` on resolved pools

After every input pool is resolved, the extractor checks that no `bodyId` is in two pools. If one is, it raises
`E-POOL-OVERLAP: pairs <a> and <b> share bodyId <id>` with the smallest shared id. The declared-set check from spec 019
still runs first, but it skips two pairs when either declares a receptor filter, because their declared sets may share
a subclass while their neurons do not.

## 4. Output `song`

```json
"song": { "types": ["pIP10"], "drive": "song" }
```

`drive: "song"` is allowed at most once. A config that declares it is written with **channel declaration v6**
([channel-declaration-v6.md](channel-declaration-v6.md)). A config without it is still written as v5.

## 5. `fidelity.checks`

The format already accepts `contrast` checks for any declared pair. The social config adds:

```json
{ "kind": "contrast", "pair": "odour-conspecific", "minFraction": 0.1 },
{ "kind": "contrast", "pair": "contact-pheromone", "minFraction": 0.1 }
```

`fidelity.require` stays `true`. A failing social check stops extraction with the existing named error, and ADR 012
records it as a finding. Bridges are not hand-added.

## 6. Size

`fill.neuronCount` is the MB brain's 14,500 plus the bodies the new seeds and pools add (research R5), so the fill size
does not change. The extraction report prints both numbers, the overlap with the MB brain's `bodyId` set, and every
pool's count per side together with its unknown-side drops.

## Tests (extractor)

- Each new key: valid, invalid shape, unknown key.
- `E-SEED-EMPTY` for a misspelt type.
- `E-POOL-OVERLAP` when `contact-pheromone` drops its `receptorTypes`. The shipped config passes.
- v6 written only with `song`. Old configs give byte-identical snapshots: re-extract the MB config and compare hashes.
