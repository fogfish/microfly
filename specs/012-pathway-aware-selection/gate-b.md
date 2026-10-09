# Gate B: simulator timing, re-confirmed (pathwayBias)

**Not run — requires a browser.** `public/tests/forager-timing.html` runs six `v1` flies in their own Web Workers
and reports the tick-interval mean/p95 as seen by a visitor; this needs an actual browser executing Web Workers.
This session has no browser automation tool available (no Playwright/Puppeteer — and `AGENTS.md` forbids adding
one, since this project has no build step or `npm install`; no browser MCP tool was available either). Feature
`008-hungry-forager-brain` did not leave a committed `gate-b.md` either, for the same reason.

## To run this manually

```bash
cd public && python3 -m http.server 8000
# open http://localhost:8000/tests/forager-timing.html?seconds=60
```

Record the six flies' mean/p95 tick time here. No regression is expected from this feature: it changes only the
forager brain's admitted interneuron set and edge count within the browser's existing worker/protocol/LIF code
(unchanged by this feature — see plan.md's Constitution Check), and the new neuron/edge counts (3,320 neurons,
198,756 edges) are close to the previous shipped brain's (3,408 neurons, 205,129 edges), well inside the
`~60 s` extraction-time scale the LIF core was already benchmarked at. If a regression is found when this is run,
record it here as a finding, per `AGENTS.md`'s "behaviour failures are findings" — do not tune the rule to hide it.

## Related finding carried from Gate A

Gate A (`gate-a.md`) found that, at the LIF test suite's existing `outputScale` assumptions, the `forward` and
`feed` output channels now produce zero spike rate (see `tests/fly-brain-v1.test.mjs`'s failing BUG-002 case,
discussed in the completion report). This is a calibration consequence of the admitted-neuron-set change, not a
timing regression, but it is worth keeping in mind when this Gate B run is eventually performed: a dead output
channel would show as a flat `outputs[k]` in the timing page too, even though the *tick interval* itself (what
Gate B actually measures) is not expected to change.
