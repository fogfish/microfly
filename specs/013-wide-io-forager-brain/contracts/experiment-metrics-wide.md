# Contract: Experiment and comparison, wide-I/O brain (brain v2)

**Owner**: `scripts/forager-arms.mjs` (the experiment, extended) and `public/js/fly/metrics.js` (pure metric
functions, Node-testable). **Amends**: [experiment-metrics.md](../../008-hungry-forager-brain/contracts/experiment-metrics.md)
and its own ADR 006 Gate C extension. Existing arms and metrics are unchanged; this contract adds one arm and four
gated metrics plus one telemetry-only report, per ADR 007's Acceptance (Gate C).

## Command

```text
node scripts/forager-arms.mjs --world=world/world-forager-wide.json [--brains=wide,v1-11k,random-matched-wide,baseline]
                               [--seeds=held-out] [--verbose] [--json=<file>]
```

## Arms

| Arm | Brain | Notes |
|---|---|---|
| `wide` | The wide-I/O snapshot (`kind: "forager-wide"`), `v2` runner (`forager-step-wide.js`) | The brain under study. |
| `v1-11k` | The shipped 11K snapshot (`kind: "forager"`), `v1` runner | Null arm 2 (ADR 007 Acceptance). |
| `random-matched-wide` | A degree-preserving rewiring (`rewire`, unchanged) of the `wide` snapshot, `v2` runner | Null arm 3: separates connectome structure from size, at the wide brain's size. |
| `baseline` | Random walk, no brain | Null arm 4. |

`wide` and `random-matched-wide` both sense through `senseForagerFlyWide`/`forageEnvWide` and the world's
`flies.stimuli`/`flies.body.sites`; `v1-11k` keeps using the unchanged `senseForagerFly`/`forageEnv`. Every arm
reads the same held-out seeds and the same spawn, as the existing contract requires.

## Metrics (ADR 007 Acceptance, Gate C)

Metrics 1–5 are ADR 003's existing five (find, approach, eat, leave, hunger dependence), computed exactly as
experiment-metrics.md describes, for every arm above. New, gated:

6. **Brake** (`brakeMedian`): the median raw `forward` drive with the mouth site on a flower, divided by the
   median raw `forward` drive off any flower, for hungry-start flies. Must be `< 1` for the `wide` arm, and lower
   than `random-matched-wide`'s value. **The existing `eat` metric must also pass for the `wide` arm** — ADR 007:
   "Eat must pass for this arm. This is the metric neither v1 nor 11K could pass."
7. **Stay** (`stayMedian`): median ticks per closed bout (from `fly.bouts`, unchanged `closeBout` shape), compared
   against the `v1-11k` arm's value.
8. **Avoid** (`avoidFraction`): the fraction of ticks a fly spends within 1.5 tiles of a danger source, and
   separately of a heat source, reported against the `baseline` (random-walk) arm's value, with its sign.
   *(BUG-001)* The source is the one the sense reads (`flies.stimuli['odour:danger'|'heat'].from`). For
   `forestEdge`/`water`, the distance is the fly cell's tile-step ring in the world's danger or heat field, so
   "within 1.5" is ring 1, next to the source. For `dangers` it is the distance to the nearest point of the declared
   `kinds`. For a world with no flies.stimuli (v1) it is the spider/lantern points. A world without the source
   reports `n/a`, not 0 %. The columns are `avoidDanger`/`avoidHeat` (formerly `avoidSpider`/`avoidLantern`). Heat must not be
   closer-than-baseline; danger's result is reported only, not gated (ADR 007 D19/Annex A5: its sign depends on
   hop count, so gating it would gate on a probe artefact).
9. **Touch** (`touchTurn`): mean turn toward the touched side over the ten ticks following a one-sided touch
   event (`touch-left` or `touch-right` input exceeding `0`), compared against `baseline`: `turnLeft − turnRight`
   after a left touch, `turnRight − turnLeft` after a right touch. The probe predicts a turn toward the touched
   side, so it predicts a positive value. *(BUG-001: the side sign was missing, so the value measured the fly's
   left-turn bias.)*

Telemetry only, never gated:

10. **Escape** (`escapeMean`): mean `escape` output drive while within the world's danger radius versus outside
    it. *(BUG-001)* "Within" means the danger or heat sense reads a value there: a non-zero field ring (distance < 3)
    for a field source, or within the sense's `radius` of a declared point. Reported for every arm that has an
    `escape` output; no pass/fail attached (ADR 007 D17: "Escape is excluded from the behaviour claims of this
    ADR").

All new metric functions live in `public/js/fly/metrics.js`, pure and unit-testable on a synthetic history array,
matching the existing metrics' shape (`findRate`, `approachMedian`, etc.).

**Verdict**: as the existing contract — each gated metric prints its value and whether it meets ADR 007's stated
expectation; a failing metric is printed as failing, with the run and seeds, and is never adjusted to pass
(AGENTS.md: "Behaviour failures are findings").

## Table

```text
arm                   find [CI]   brake   stay   avoid(danger/heat)   touch   escape(in/out)   seeds
baseline               …
wide                   …
v1-11k                 …
random-matched-wide     …
```

## Reproducibility

As the existing contract: the run record stores the world file hash, the snapshot's `configHash`, the held-out
seeds, and the LIF parameters of each arm. The same inputs give the same record.

## Timing

Unchanged: `tickMs` is recorded from the browser host clock when the run is made in the page; the Node run does not
record it.
