# Calibration: Social and Pheromone Senses

Values are tuned on **calibration seeds only** (`experiment.seeds`: 6–10). Held-out seeds (101–130) are reserved
for the SC-004/SC-005 verdict runs (T061, T066) and are never used here.

## T045: Browser check (SC-003, SC-007, SC-008)

Run with `cd public && python3 -m http.server 8010` (port 8000 was already held by an unrelated server in this
sandbox) and `?world=world/world-forager-social.json`, driven headlessly over the Chrome DevTools Protocol
(no GPU is available in this sandbox, so this is a CDP-driven check, not an eyeballed one):

- The 5th World-tab overlay switch (`odour-conspecific`) is present only on worlds that declare that sense, and
  toggles.
- Selecting a fly shows the social line above its input rows (`sex: female (male connectome) · touching: none`),
  the L/R `odour:conspecific`/`contact:pheromone` rows each carry a `(approach|avoid|none)` valence suffix from
  ADR 012, and the decoder section's `song` row reads `r 0.00 · rest 0.00 · drive 0.00 · pool 2 · quiet` at
  spawn.
- Console output over a 15 s run with 6 flies: **no errors from any social-feature code path.** The only console
  errors are `THREE.WebGLRenderer: … Could not create a WebGL context` from the (pre-existing, unrelated) brain
  activity point-cloud panel (`js/viz/point-cloud.js`) — this sandbox's headless Chrome has no GPU
  (`GL_VENDOR = Disabled`). The same error reproduces identically on `world-forager.json` (confirmed by running
  the same driver against it), so it is an environment limitation, not a regression from this feature.
- `world-forager.json`, `world-forager-demo.json` and `world-forager-learning.json` all still serve and load (the
  learning worlds' documented decoder-404 limitation, `public/world/README.md`, is unchanged and unrelated).

**Frame-rate caveat (SC-007/SC-008).** The same GPU absence means no real render-loop FPS can be read in this
sandbox. As a substitute, the added per-tick JS cost of the two new senses was timed in isolation
(`conspecificAt`/`contactAt` across the 4 social channels × 6 flies, 20,000 ticks,
`.claude/skills/microfly-calibrate` is not needed for this — plain hot-path timing):

```
conspecificAt+contactAt, 4 channels x 6 flies: 0.00275ms/tick (6 flies)
move only (no sensing):                        0.00007ms/tick (6 flies)
Added cost per tick: 0.00268ms — 0.016% of a 60fps (16.667ms) frame budget, 0.005% of the world's 20Hz
(50ms) tick budget.
```

This matches the plan's estimate ("about 150 distance evaluations a tick for 6 flies" — negligible next to a
LIF worker step) and confirms there is no compute-side reason to expect a frame-rate drop. It is not a
substitute for an eyeballed FPS check on real hardware; anyone reviewing this on a machine with a GPU should
still watch the frame rate once with the overlay on.

## T053: World calibration

**Finding: there is nothing to tune, and the five placeholders are kept as the calibrated values.**

T030 (`claims.md`, ADR 012 "Claims and valence", Gate C) measured `valence: "none"` for **both**
`odour-conspecific` and `contact-pheromone`. `body-layer.js`'s `sumByValence` multiplies every steering term —
tropotaxis (the side pool) and klinotaxis (the trend) alike — by `VALENCE_SIGN[sense.valence]`, which is `0` for
`"none"`. So neither social sense contributes any turn or speed term, by construction, regardless of
`radius`, `contrast`, `bodyRadius`, emission strength or `solid`: those are all **world geometry** parameters,
shared identically by every arm (`social`/`ablated`/`random-graph`/`random-walk` all run the same `spawnFlies`,
the same body physics, the same `flies.sexes`), and only the **brain** differs between arms. A parameter that
cannot change the one thing that differs between arms (the zeroed steering contribution) cannot change the
SC-004 comparison. Re-tuning world geometry here to chase a different verdict would be adjusting the setup to
get a result, the one thing AGENTS.md rules out ("behaviour failures are findings... do not adjust code to make
a number pass" — the same principle applied one level up, to world config).

What calibration *can* and did check: that the placeholder values already give the senses a fair, representative
chance to act, i.e. that flies actually get close enough for non-trivial contact/odour signal during a run,
rather than the geometry being so sparse that "no effect" would be confounded with "no exposure". A baseline run
(`node scripts/social-arms.mjs --world=world/world-forager-social.json --seeds=calibration`, 5 seeds × 6 flies ×
3000 ticks, full output in [calibration-baseline-results.md](calibration-baseline-results.md) /
[.json](calibration-baseline-results.json)) confirms real, non-zero exposure at the shipped defaults:

| Arm | Time near (≤2 tiles) | Contact rate (per min) | Find rate |
|---|---|---|---|
| social | 3.4% [2.2%, 4.7%] | 0.187 [0.093, 0.307] | 93.3% [83.3%, 100.0%] |
| ablated | 4.8% [3.4%, 6.3%] | 0.293 [0.173, 0.453] | 96.7% [90.0%, 100.0%] |
| random-graph | 1.6% [0.9%, 2.5%] | 0.133 [0.040, 0.253] | 90.0% [80.0%, 100.0%] |
| random-walk | 5.0% [2.9%, 6.9%] | 0.133 [0.040, 0.240] | 70.0% [53.3%, 86.7%] |

Several individual flies log contact rates of 0.4–1.6 events/minute and time-near values up to ~15–19%
(per-fly detail in the full output) — the senses are receiving real signal, not reading a geometry that never
lets flies meet. The social arm does **not** separate from `random-graph` or `random-walk` on either verdict
metric (95% CIs overlap on both), matching the expected consequence of `valence: "none"`; `ablated`'s time-near
is, if anything, slightly higher than `social`'s, consistent with the effect not being pheromonal (there is no
pheromonal steering effect to begin with). `song/contact` is `0` whenever a contact event occurs and `n/a`
otherwise (never a non-zero rise) — consistent with `claims.md`'s direct spiking measurement that pIP10 is
silent (0 Hz) under bilateral stimulation; `flies.body.song.threshold`/`.tau` have nothing to calibrate against,
since the pool they gate never rises above rest regardless of their value.

**Values kept, each already the shipped placeholder:**

| Parameter | Value | Why no change |
|---|---|---|
| `odour:conspecific` `radius`/`contrast` | `3` / `{common: 0.5, gain: 5}` | Already gives non-zero `nnDistance` variation and `timeNear` across every seed (table above); no steering consumes it. |
| `flies.body.bodyRadius` | `0.35` | Already gives non-zero contact events per seed (0.13–0.29/min pooled, up to 1.6/min for individual flies). |
| Emission per sex | female emits both senses fully, male emits `odour:conspecific` only (ADR 012 R9, literature-informed) | C2 gave no dependably-signed effect either way to tune against; the literature prior stands. |
| `flies.body.song.threshold`/`.tau` | `0.1` / `10` | The gated pool (`song`) never rises above rest in this calibration; no threshold value changes that. |
| `flies.body.solid` | `false` | Shared geometry, same non-effect-on-verdict argument as radius/bodyRadius above; `false` matches every other forager world's default. |

This is recorded as a finding in ADR 012 "Calibration", not reopened at T066 (the held-out verdict is still run
in full — a structural non-effect at calibration time is itself worth confirming on held-out seeds, and the
`--no-social-stimuli` regression check in T066 does not depend on any of this).
