# AGENTS.md

Guidance for coding agents working in this repository. For what the project is and how it works, read [README.md](README.md) first. The binding rules are in the [constitution](.specify/memory/constitution.md). When this file and the constitution disagree, the constitution wins.

## Project in one paragraph

microfly runs spiking brains cut from the male *Drosophila* connectome (MaleCNS v1.0) inside a browser world. A Python extractor turns the dataset into `.brain` snapshots. The static web app loads a snapshot into one Web Worker per fly, runs a leaky integrate-and-fire (LIF) network, and lets the world move the fly from the brain's motor outputs.

## Layout

| Path | What lives there |
|---|---|
| `public/` | The web app and the web root. Plain HTML, CSS and native ES modules. |
| `public/js/brain/` | LIF cores (`lif-v0.js`, `lif-v1.js`), brain runners, worker, protocols, snapshot reader. |
| `public/js/fly/` | Body, energy, food, stimulus, actions, the host that owns the workers. |
| `public/js/world/`, `public/js/render/`, `public/js/ui/` | World composition, canvas rendering, side panel. |
| `public/brains/` | Brain inspector (three.js, vendored) and the shipped `.brain` snapshots plus `brains.json`. |
| `public/world/` | World configs. `world/README.md` explains brain versions and seeds. |
| `extract/` | Python extractor (`malecns_brain`), its configs and tests. |
| `scripts/` | Experiments: baseline comparison, calibration, benchmarks. |
| `tests/` | Node test suites. `tests/slow/` holds long behaviour runs. |
| `adrs/` | Architecture decisions, one per brain generation. |
| `specs/NNN-*/` | Spec Kit features: `spec.md`, `plan.md`, `tasks.md`, `contracts/`, results. |
| `malecns.md` | Field guide to the dataset. Read it before touching extraction. |
| `inspector/malecns-3d.html` | Standalone dataset viewer. Do not modify. |
| `data/` | The external dataset and large snapshots. Git-ignored. Never commit it. |

## Commands

```bash
# Run the app (web root is public/)
cd public && python3 -m http.server 8000
#   http://localhost:8000/?world=world/world-forager.json   forager brain (v1)
#   http://localhost:8000/brains/                           brain inspector

# JS tests (Node 20+, built-in test runner, no install)
npm test                                  # tests/*.test.mjs
npm run test:slow                         # tests/slow/*.test.mjs
node --test public/tests/*.test.js        # world generation tests

# Python extractor tests
cd extract && python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -t .

# Extract a brain (needs the dataset)
cd extract && MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/forager-brain.json --out ../public/brains/forager-brain.brain

# Behaviour experiment on held-out seeds
node scripts/compare-baseline.mjs --world=world/world-forager.json --seeds=held-out
```

There is no `npm install`, no bundler and no build step. Do not add one.

## Hard rules

These come from the constitution. Breaking one needs an amendment, not a workaround.

1. **Static web, zero build.** Plain JS with ES modules. No frameworks, no transpilers, no runtime backend. A third-party browser library is only allowed as a vendored file, justified in a plan.
2. **One fly, one worker.** No neural computation on the main thread. The main thread and workers talk only through the versioned protocol (`protocol.js`, `protocol-v3.js`).
3. **Brains come from the dataset.** Weights come from synapse counts, signs from predicted transmitters, and neurons keep `bodyId`, `type`, `class` and `superclass`. Synthetic networks exist only as labelled test fixtures. Never hand-wire a connection to fix behaviour.
4. **Extraction is config, not code.** A brain is a file in `extract/configs/`. The same config and dataset must give a byte-identical snapshot (apart from `provenance.createdAt`). The extractor fails with a named error code instead of guessing.
5. **The LIF core stays pure.** `lif-*.js` has no DOM or worker code, every parameter is named in its defaults and validated, and the same seed gives the same spikes. New mechanisms are off by default, and with defaults `lif-v1.js` must match `lif-v0.js` bit for bit (`tests/lif-golden.test.mjs`).
6. **Behaviour comes from the brain.** The world never steers, stops or feeds a fly. Stimulus → sensory and motor → action mappings are declared in data (snapshot channels, world config), not hidden in world code.
7. **Keep it simple.** Prefer the browser platform and `pyarrow`/`numpy` over new dependencies.

## Working on brains

- **Behaviour failures are findings.** If a brain fails a metric, change config or LIF parameters, record the run that motivated it (see `specs/008-hungry-forager-brain/calibration.md` and `gate-c.md`), and say so. Do not adjust code to make a number pass.
- **Separate calibration and evaluation seeds.** `experiment.seeds` are for calibration and `experiment.heldOut` for verdicts. Never tune on held-out seeds.
- **Compare against the null arms.** Report the random walk and the size-matched random graph alongside the brain.
- **Old brains keep working.** `mock`, `v0` and `v1` brains and their worlds must all still load. When a format moves a version, keep the reader for the old one.
- **The dataset is large.** Feather files go up to 13 GB. Use column selection and filtered or batched reads. Never load a large file whole.

## Contracts

Snapshot format, worker protocol, world config, channel declaration and LIF parameters are documented contracts under `specs/*/contracts/`. The latest are in `specs/008-hungry-forager-brain/contracts/`. A change to any of them must:

- update the contract document in the same change;
- bump its version when the change is incompatible, and keep the old reader;
- add contract tests on both sides (Python writer and JS reader, or host and worker).

## Workflow

- Features follow Spec Kit: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Bugs use `/speckit-bugfix-report` and `/speckit-bugfix-patch`. Every plan has a Constitution Check.
- Branches are numbered by feature: `NNN-short-name`.
- Commit messages are short and prefixed: `(fea) …` for features, `(fix) …` for fixes.
- Before calling a feature done: `npm test` passes, extractor tests pass if Python changed, and the app starts with the static server and runs at least one fly with no console errors.

## Code style

- Match the surrounding code. Modules open with a comment naming the ADR or contract they implement.
- Comments explain why and cite the decision (`ADR 003 L2`, `W4`, `BUG-002`). No unexplained constants.
- Pure functions where possible. Hot loops use typed arrays and avoid allocation per step.
- Python: standard library plus pinned `pyarrow` and `numpy`. Every sort has an explicit key, and ties break on `bodyId`.
