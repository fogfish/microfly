# Extraction report: smallest functional brain (male-cns-v1.0)

Command (from `extract/`):

```text
MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/smallest-functional-brain.json \
  --out ../public/brains/smallest-functional-brain.brain
```

## Console report (final run, `expectedNeuronCount` = 11)

```text
dataset        male-cns-v1.0 (traced-only)
neurons        11   (sensory 1, left 1, right 1, interneurons 8)
edges          78
transmitters   acetylcholine 10, gaba 1
weights        min -1, max 1; synapses min 1, max 836
readouts       LEFT body 10118 (two-hop input 31), RIGHT body 10065 (two-hop input 906)
reserved       LEFT via body 10702, RIGHT via body 530777
output         ../public/brains/smallest-functional-brain.brain (3264 bytes)
self-check     identical
```

## Checks against the research

- **R3 (reserved LEFT slot):** the LEFT slot is body 10702, as predicted. The plain top-8 rule would have selected no LEFT-reaching interneuron.
- **R4 (readout asymmetry):** LEFT two-hop input is 31 and RIGHT is 906. The asymmetry is reported, not corrected.
- **Reproducibility:** the self-check run is identical. The reruns in this report differ only in provenance (see below).

## `expectedNeuronCount`

Set to 11 in `extract/configs/smallest-functional-brain.json` and rerun.

Comparing the output before and after that change:

- `offsets`, `targets`, `weights`, `synapses` (the body): byte-identical.
- `neurons` (the header node list): identical.
- `provenance.configHash` changed, because `expectedNeuronCount` is part of the config. This is the expected effect of hashing the whole config.
- `provenance.createdAt` changed, as expected.

## Failure contract on real data

Run with `MALECNS_DIR=/nonexistent`:

```text
E-DATASET-MISSING: required file not found: /nonexistent/body-annotations-male-cns-v1.0-minconf-0.5.feather
exit=1
```

Checksum of `public/brains/smallest-functional-brain.brain` (sha256):

- before: `ea292e2d6b8456dc3f25d58e0c30fe9a66576b3ab8c01b882b853295ad447e64`
- after:  `ea292e2d6b8456dc3f25d58e0c30fe9a66576b3ab8c01b882b853295ad447e64`

Unchanged.
