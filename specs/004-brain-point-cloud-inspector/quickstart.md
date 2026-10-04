# Quickstart: Brain Point-Cloud Inspector

**Feature**: `004-brain-point-cloud-inspector` | Run and validation guide. Design details are in [plan.md](plan.md), [data-model.md](data-model.md) and [contracts/](contracts/). Implementation tasks are in `tasks.md` (not created here).

## 0. Prerequisites

- The MaleCNS v1.0 Feather files in `data/malecns/` (git-ignored; see `malecns.md`).
- The extractor's scratch environment, as in spec 003: `cd extract && .venv/bin/python -m pip install -r requirements.txt`.

## 1. Check the inspector original is untouched

```sh
shasum -a 256 inspector/malecns-3d.html
# expect fcd9e96285aa49b6256b28a829607b491edb4c71df103851477be4ddfda0775c
```

## 2. Regenerate the reference brain with positions

```sh
cp public/brains/smallest-functional-brain.brain <scratch>/before.brain   # keep the old file for comparison; <scratch> is a directory outside the repo
cd extract
MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/smallest-functional-brain.json --out ../public/brains/smallest-functional-brain.brain
```

Expected:
- exit status 0, `self-check identical`;
- a `positions  11 with soma, 0 without` line (all reference neurons have a dataset position);
- the same neuron count and bodies as before.

Then confirm only the header changed. The body bytes must be identical:

```sh
.venv/bin/python -c "
import struct, sys
def body(p):
    b = open(p,'rb').read(); H = struct.unpack('<I', b[8:12])[0]; return b[12+H:]
print('body identical:', body('<scratch>/before.brain') == body('../public/brains/smallest-functional-brain.brain'))
"
```

Expected: `body identical: True`.

## 3. Run the tests

```sh
cd extract && .venv/bin/python -m unittest discover -s tests -t .   # Python: selection, container, CLI, positions
cd .. && npm test                                                  # JavaScript: reader, model, manifest
```

Expected: all pass. The new tests cover `soma` and `superclass` round trips, `null` handling, the report line, the malformed-`soma` rejection on both sides, the region rule, group centroids, and top-N edges on a small fixture.

## 4. Start the app and open the inspector

```sh
python3 -m http.server 8000 -d public
```

Open `http://localhost:8000/brains/`.

Check:
1. The reference brain loads. The counts show 11 neurons and 78 edges in the file, and all are drawn.
2. Level switches between Region, Superclass, Class and Type. Groups and the legend update.
3. Connections switch between Group graph and Top body-to-body, and the top-edge slider changes the number of drawn edges.
4. Hovering a point shows its identity; clicking pins it.
5. Reset view returns to the starting view.
6. The browser console shows no errors.
7. The simulator still runs: open `http://localhost:8000/`, confirm one fly starts with no console errors.

## 5. Check the error paths

- Open `http://localhost:8000/brains/?brain=does-not-exist.brain`. Expect the error panel naming the file, and no view.
- Copy `tests/fixtures/synthetic-smallest.brain` into `public/brains/` as a scratch file, change its version bytes (offset 4) to `3`, and open it with `?brain=`. Expect the reader's message "unsupported snapshot version 3; this build supports 2", and no view. Delete the scratch file afterwards.
- Copy the pre-change reference brain (saved in step 2) into `public/brains/` as a scratch file and open it. Expect "No neuron has a 3D position". Delete the scratch file afterwards.

## 6. Full admitted subgraph (optional, local only)

The full admitted subgraph is a benchmark file and is not committed. To view it, generate it with the config used by `tests/bench_full_admitted.py`, copy it into `public/brains/` locally, and add a manifest entry. Expect the edge cap (3,000 at most) and the on-screen count of drawn edges. Remove the file before committing.
