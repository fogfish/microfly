# Contract Amendment: `pathwayGain` (L11) and `plasticity` (L12) on LIF core version 1 (`lif-v1.js`)

**Amends**: `specs/008-hungry-forager-brain/contracts/lif-v1.md`, the canonical LIF-v1 contract. It is updated in
the same change. **Decided in**: ADR 011 (to be written; research.md §3, §5). This is a **backward-compatible
addition**: both parameters default to `null` (a no-op), so there is no version bump. G1 (bit-exact to `lif-v0.js`
with defaults) holds unconditionally.

## Parameter table addition

| Name          | Default | Meaning                                                                                       |
| ------------- | ------- | --------------------------------------------------------------------------------------------- |
| `pathwayGain` | `null`  | Gains on excitatory edges chosen by presynaptic and postsynaptic `class` or `type`. `null`: weights as given |
| `plasticity`  | `null`  | Three-factor depression on KC→MBON edges. `null`: no plastic state, no per-step work          |

### `pathwayGain` (L11)

```json
{ "routes": [ { "from": "olfactory", "to": "ALPN", "gain": 5 },
              { "from": "ALPN", "to": "Kenyon_Cell", "gain": 3 } ],
  "otherExcitatoryInto": ["ALPN", "Kenyon_Cell"],
  "otherGain": 0.3 }
```

- It applies only to edges with weight > 0. A route edge (pre class `from`, post class `to`) is multiplied by
  `gain`. Any other positive edge whose post class is in `otherExcitatoryInto` is multiplied by `otherGain`.
- **Type selectors (ADR 011 D40).** Either end of a route may name a dataset `type` instead of a `class`:
  `fromType` in place of `from`, `toType` in place of `to`. This reaches neurons the dataset leaves without a class,
  such as APL (`{ "from": "Kenyon_Cell", "toType": "APL", "gain": 30 }`). Each end names exactly one selector.
  `otherExcitatoryInto` stays class-only.
- An edge that matches several routes takes the `gain` of the **first declared** one. Class-only routes cannot
  overlap, so configs written before type selectors behave exactly as before.
- It is applied once in `createNetwork` to a copy of the weights, after L8 and before L12 takes its base copy.
- It needs `graph.neuronClass` and, for type routes, `graph.neuronType` (arrays of strings, one per neuron, `null`
  allowed), which `fly-brain-v1.js` passes from the manifest.

`resolveParams` rejects, naming the path:
- not an object, `routes` not an array, or a route end with both or neither of `from`/`fromType` (`to`/`toType`):
  `'LIF parameter "pathwayGain" must be null or an object with routes'`;
- `gain`/`otherGain` not finite ≥ 0: `'LIF parameter "pathwayGain.routes[i].gain" must be a number of 0 or more'`;
- a repeated route: `'LIF parameter "pathwayGain" repeats route <from>→<to>'`, a type end printed as `type:<name>`.

`createNetwork` rejects a class or type that no neuron has: `E-LIF-PATHWAY: class "<name>" is not in the snapshot`,
`E-LIF-PATHWAY: type "<name>" is not in the snapshot`.

### `plasticity` (L12)

```json
{ "tauElig": 400, "tauRate": 20, "tauBaseline": 4000, "threshold": 0.01,
  "etaReward": 0.05, "etaPunish": 0.05, "wMin": 0.2, "tauForget": 30000, "dopamine": "pool" }
```

Missing keys take the defaults shown. `resolveParams` rejects an unknown key, any τ ≤ 0, any `eta` < 0,
`threshold` < 0, `wMin` outside [0, 1), or a `dopamine` value other than `"pool"` / `"shuffled"`, naming the key.
For example: `'LIF parameter "plasticity.wMin" must be from 0 to less than 1'`.

It needs `graph.learning = { kc, reward, punish, approach, avoid }` (sorted index arrays). Missing gives
`E-LEARN-MISSING: plasticity needs learning groups`.

**Update, per step, after the spike pass and before the buffer swap:**

```text
e_i      ← e_i · exp(−1/tauElig) + spikes_i                       i ∈ kc
r_g      ← r_g + (mean spikes of group g − r_g) / tauRate         g ∈ {reward, punish}
b_g      ← b_g + (r_g − b_g) / tauBaseline
D_g      = max(0, r_g − b_g − threshold)                          (shuffled: ring[g][lag], see below)
wmod_j   ← max(wMin, wmod_j − eta_g · D_g · e_pre(j))             j: avoid slots for g = reward, approach slots for g = punish
every 10 steps: wmod_j ← wmod_j + (1 − wmod_j)·(1 − exp(−10/tauForget))   all slots
weights[slot_j] = base[slot_j] · wmod_j                           for every slot changed this step
```

- `b_g` starts at the first step's `r_g`, so there is no start-up transient that counts as dopamine.
- **Shuffled.** `D_g` is written into a ring of 4,000 steps. The value used is the one at a lag drawn uniformly
  from [1000, 4000] by a third PRNG stream (`createPrng(seed ^ 0x504c4153)`), redrawn every 200 steps. It is created
  only in shuffled mode.
- **Telemetry.** `net.learning = { dReward, dPunish, wmodApproach, wmodAvoid }`, refreshed each step (the means over
  slots).

## Guarantees

- **G1 (unchanged).** With every default, `lif-v1.js` equals `lif-v0.js` bit for bit (`tests/lif-golden.test.mjs`).
- **G6 (new).** `plasticity: null` and `pathwayGain: null` give spikes identical to the same parameters without
  the keys, on the wide-brain fixture (`tests/lif-plasticity-golden.test.mjs`).
- **G7 (new).** With plasticity on, two runs with the same graph, parameters, drive and seed give identical spikes
  and identical `wmod` arrays.
- **G8 (new).** `wmod` stays in [wMin, 1] at every step. The snapshot's own `weights` array is never written.

## Contract tests

- `resolveParams`: each rejection above.
- A toy fixture (labelled synthetic, 3 KCs, 1 approach MBON, 1 avoid MBON, 1 PAM, 1 PPL1): reward depresses only
  KC→avoid edges of spiking KCs; punishment only KC→approach; recovery approaches 1; tonic DAN firing (constant rate)
  gives D = 0 after the baseline settles.
- G6, G7 and G8 as above.
