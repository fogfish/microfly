---
name: microfly-calibrate
description: Run or continue LIF calibration for a microfly forager brain (v1, v2, and future generations) using the deterministic calibrate.mjs CLI in this skill's own scripts/ directory, instead of re-deriving the ADR 005/006 staged protocol and rebuilding tooling from scratch each time. Triggers on requests to calibrate, tune, or search LIF/synaptic parameters for a forager brain, or when a behaviour gate (rest regime, brake, find rate) is failing because a brain's shipped settings are uncalibrated starting values. Always asks the brain version and a time/compute budget before running anything, and never promotes a result into the shipped world config or calibration.md without the user reviewing it first.
model: sonnet
user-invocable: true
disable-model-invocation: false
---

## What this skill is for

Calibrating a forager brain's LIF parameters is a staged search (ADR 005 Annex B, generalised by ADR 006's own
"Calibration protocol" section) that was previously re-derived and re-tooled by an agent, by hand, every time —
burning a large amount of context on context no human needed to re-explain and on scripts that had already been
written once before (for v1) and had to be rebuilt for v2 in-session. This skill fixes that split:

- **The search itself is a deterministic Node program** (`scripts/calibrate.mjs` in this skill's own directory,
  plus `scripts/engine.mjs` and one `scripts/profiles/<version>.mjs` per brain generation). It takes no LLM calls,
  makes no judgment calls that are not already an explicit, documented rule, and can run for hours unattended as
  a plain background process — "a normal program," not an agent loop.
- **Your job, as the agent running this skill, is thin on purpose:** ask the human what they want (version,
  scope, budget), invoke the CLI with the resulting flags, and report back what it found. Do not re-derive the
  A1/A2/B protocol from the ADRs, do not write new probing code, and do not spend extended reasoning interpreting
  the CLI's numbers beyond what is needed to fill in the report template below — the CLI's gates already decided
  pass/fail; you are relaying, not re-judging. This is also why this skill names a smaller model: nothing in this
  flow needs frontier-level reasoning once the CLI exists.

## Context you need (do not re-derive this; reread it, don't re-research it)

- **The staged protocol.** A1 "regime": brain-only probes (fixed sense inputs, no world, no body) gate each grid
  point's region-level rest/odour/brake/feed behaviour — quiet at rest (0.2-10% activity), responsive to odour,
  and taste lowers raw `forward`/raises raw `feed`. A2 "readout": for a robust A1 pass, fit `outputScale` per
  channel to a target operating point (cheap — output neurons have no outgoing edges, so this never re-simulates
  the network). B "world": the fitted candidates run on the 5 **calibration** seeds (never the 30 held-out ones)
  against the random walk; only then, if a candidate looks good, does a human run a **separate**, explicit
  held-out validation before anything is adopted. Source: `adrs/005-dynamical-regime.md` Annex B,
  `adrs/006-cautious-forager-brain-15k.md` "Calibration protocol", and the worked precedent in
  `specs/008-hungry-forager-brain/calibration.md`.
- **Per-version differences are profiles, not re-reading the ADRs.** `scripts/profiles/v1.mjs` and `v2.mjs`
  already encode each version's world/snapshot path, grid axes, per-region gates, and how to build a brain config
  and a probe input vector. Adding a future brain generation (v3+) means writing a new `profiles/v3.mjs` against
  the same shape — read an existing profile as the spec for the next one, not the ADRs again.
- **v1 is already calibrated** (specs/008's `calibration.md`, adopted 2026-10-05/09) — its profile exists mainly
  so the generic engine has a known-answer case, not because v1 needs recalibrating. v2's calibration is open
  (specs/013-forager-brain-15k-lif-v2/calibration.md records the first look: the shipped L11 values are ignited,
  and `al` specifically stays ignited even at very low overall scale — a `groupGain.al` candidate, not yet found).
- **Hard rules this skill must not violate** (AGENTS.md, "Working on brains"): calibration seeds
  (`experiment.seeds`) only, ever, for tuning; held-out seeds (`experiment.heldOut`) only for the one-time
  verdict, run separately, after a candidate is chosen. A failing metric is a finding to record, not a bug to
  code around. Old brains (`mock`/`v0`/`v1`) must keep working — this skill's `--version` flag selects a profile,
  it never edits another version's files.
- **Nothing here auto-ships.** `calibrate.mjs` only ever writes JSON checkpoints and prints a summary under
  `--out`. Updating `public/world/world-forager*.json`, `extract/configs/*.json`, or
  `specs/*/calibration.md`/`gate-c.md` with a chosen result is a separate, explicit, human-reviewed edit — never
  something this skill or its CLI does on its own.

## Step 1 (mandatory): ask before starting anything

Before running any command, use `AskUserQuestion` to get the human's high-level direction. Do not guess these —
they trade off real wall-clock time and are exactly the kind of call AGENTS.md reserves for a human:

1. **Brain version** — `v1`, `v2`, or a version this session should add a new profile for first.
2. **How much of the protocol to run this session:**
   - *Quick look* (`--stage=classify`, a few minutes): just scan the scale axis and report which regions (if any)
     stay ignited no matter what — useful to sanity-check a hypothesis before committing to anything bigger.
   - *Regime search* (`--stage=regime` or `--stage=auto`, tens of minutes): the real A1 grid (+ A2 fit for `auto`).
     Safe to run in the foreground; still ask for a `--budget-minutes` so a bigger-than-expected grid doesn't
     surprise anyone (the CLI prints its own cost estimate and will refuse or trim rather than silently overrun).
   - *World verification* (`--stage=world`, potentially **hours**): the expensive stage. Needs a concrete
     candidate from a prior `regime`/`auto` checkpoint and a hard `--budget-minutes`. **If the human has not
     already run `auto` and reviewed candidates, do not offer this as the first option** — steer them to `auto`
     first.
3. **Compute budget** (`--budget-minutes`) for whichever stage they picked, and whether it should run in the
   foreground (they'll wait) or the background (`Bash` `run_in_background: true`, or tell them the exact `nohup`
   command to run themselves outside this session, since "run overnight" means this does not need an agent
   session open at all).
4. Anything else they want to override: a specific `--axes` subset, a narrower `--world` path, `--shard` if they
   want to split the run across several terminals/cores themselves.

## Step 2: run it

Resolve the answers into one `node` invocation of `.claude/skills/microfly-calibrate/scripts/calibrate.mjs` from
the repo root. Run `--help` yourself first in this session if you need the exact current flag names — do not
rely on memory of this document once it may have drifted from the script. Examples:

```bash
# Quick look
node .claude/skills/microfly-calibrate/scripts/calibrate.mjs --version=v2 --stage=classify \
  --out=.claude/skills/microfly-calibrate/runs/v2-quicklook

# Regime search, foreground, soft budget
node .claude/skills/microfly-calibrate/scripts/calibrate.mjs --version=v2 --stage=auto \
  --budget-minutes=60 --out=.claude/skills/microfly-calibrate/runs/v2-auto-<date>

# World verification, background, hard budget (run via Bash with run_in_background: true,
# or hand the human this exact line to run themselves with nohup)
node .claude/skills/microfly-calibrate/scripts/calibrate.mjs --version=v2 --stage=world \
  --from=.claude/skills/microfly-calibrate/runs/v2-auto-<date>/auto.json \
  --budget-minutes=240 --out=.claude/skills/microfly-calibrate/runs/v2-world-<date>
```

Always pass `--out` to a run-scoped directory under `.claude/skills/microfly-calibrate/runs/` (git-ignored scratch
space for this skill) so checkpoints from different sessions do not collide. For a foreground run, let it print —
its own progress lines already are the "token-cheap" summary; you do not need to narrate each grid point.

## Step 3: report, don't adopt

When a stage finishes (or you check on a backgrounded one), read its checkpoint JSON (or the printed summary) and
tell the human, briefly: what passed/failed and why, the best candidate(s) if any, and the concrete next command
if they want to go further (classify → auto → world → held-out validation → adoption). If nothing passed, say so
plainly and suggest how `--axes` might need to widen — that is itself the finding, per AGENTS.md, not a failure
to fix silently. **Do not edit any shipped world config, extractor config, or `calibration.md`/`gate-c.md`
yourself based on a calibration-seed result.** Present it; let the human decide whether and when to run the
held-out step and adopt it.

## Extending to a new brain version

Copy `scripts/profiles/v2.mjs` (the more recent, better-commented one) to `scripts/profiles/v3.mjs`, point it at
the new world/snapshot paths, and fill in its axes/gates/`conditions`/`brainOf`/`fitReadout` from that version's
own ADR. `engine.mjs` and `calibrate.mjs` need no changes — `--version=v3` picks it up once the file exists.
