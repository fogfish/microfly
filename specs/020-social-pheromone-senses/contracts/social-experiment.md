# Contract: Social Experiment Runner

`scripts/social-arms.mjs`. Node 20+, no browser.

## CLI

```bash
node scripts/social-arms.mjs --world=world/world-forager-social.json \
  --seeds=held-out|calibration|<n,n,…> --ticks=<n> \
  --arms=social,ablated,random-graph,random-walk \
  [--no-social-stimuli]        # food/danger regression run (R15): drops every from:"flies" stimulus
  --out=specs/020-social-pheromone-senses/results.json
```

- `--seeds=held-out` reads `experiment.heldOut` and `calibration` reads `experiment.seeds`. If any held-out seed is
  among the seeds a calibration run used, the runner refuses (the existing `validate-held-out` rule).
- Every arm runs every seed with the same spawn (`spawnFlies`), the same sexes and one shared body-layer config
  object.

## Loop

For each tick:
1. Refresh `env.conspecifics` from every fly's body.
2. Step every fly once (`stepForagerFlyV3`; the random walk uses its baseline motor). Flies step in id order, and each
   reads the table built in step 1, so the order of stepping does not matter.
3. Record the per-fly telemetry (`world-config-v3-social.md` Telemetry).

## Arms

| Arm | Build |
|---|---|
| `social` | the shipped snapshot and decoder |
| `ablated` | `lesion(snapshot, ["odour-conspecific-left", "odour-conspecific-right", "contact-pheromone-left", "contact-pheromone-right"])`: every out-edge weight of those input neurons set to 0, indices kept, same decoder |
| `random-graph` | `rewire(snapshot, 0x52470001)` and its own C2 decoder (the same rule, the same candidates) |
| `random-walk` | baseline motor, no brain |

`lesion` and `rewire` are exported so the tests can check that `lesion` touches only those rows.

## Output

`results.json` holds:
- `{ world, seeds, ticks, arms: { <arm>: { metrics, bySex: { female, male }, forager } } }`;
- the metrics of research R14, each as `{ mean, ci95: [lo, hi] }` over seeds;
- `forager`: find rate, feeding, food-A and food-B approach, danger escape.

`results.md` is the table, plus:
- the **verdict**: time near and contact rate of `social` greater than both `random-graph` and `random-walk`, with
  95 % CIs that do not overlap;
- the `ablated` comparison;
- the `--no-social-stimuli` forager regression against the MB brain's spread.

## Tests

- A two-fly fixture with scripted bodies checks the metrics (NN distance, time near, contact events and duration,
  following index for a follower and a random pair, song-bout counting).
- `lesion` zeroes only the listed rows.
- Lockstep: swapping the step order of two flies gives identical telemetry.
