"""Synthetic test fixture, not connectome data (Constitution III).

Writes two things:

  1. A synthetic MaleCNS-shaped dataset (three Feather files with the malecns
     column names) into the directory given on the command line.
  2. The container tests/fixtures/synthetic-smallest.brain, which is the hand-checked
     result of running the ADR 002 rules on that dataset with the config in
     tests/fixtures/synthetic-config.json.

Run from extract/:  python tests/make_fixture.py <dataset-dir>
"""

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import pyarrow as pa  # noqa: E402
from pyarrow import feather  # noqa: E402

from malecns_brain.config import config_hash  # noqa: E402
from malecns_brain.container import write_container  # noqa: E402

FIXTURE_DIR = os.path.join(HERE, "fixtures")
CONTAINER_PATH = os.path.join(HERE, "..", "..", "tests", "fixtures", "synthetic-smallest.brain")
CONFIG_PATH = os.path.join(FIXTURE_DIR, "synthetic-config.json")

ANNOTATIONS = "body-annotations-male-cns-v1.0-minconf-0.5.feather"
NEUROTRANSMITTERS = "body-neurotransmitters-male-cns-v1.0.feather"
EDGES = "connectome-weights-male-cns-v1.0-minconf-0.5-traced-only.feather"

# bodyId, class, superclass, somaSide, status, type
ANNOTATION_ROWS = [
    (100, "ALPN", "ascending_neuron", None, "Traced", "synthetic-alpn-a"),   # sensory
    (101, "ALPN", "ascending_neuron", None, "Traced", "synthetic-alpn-b"),   # weaker ALPN
    (102, "ALPN", "ascending_neuron", None, "Orphan", "synthetic-alpn-c"),   # not Traced
    (200, None, "descending_neuron", "L", "Traced", "synthetic-dn-l"),        # LEFT readout
    (201, None, "descending_neuron", "R", "Traced", "synthetic-dn-r"),        # RIGHT readout
    (202, None, "descending_neuron", "L", "Orphan", "synthetic-dn-l-orphan"), # not Traced
    (300, None, "intrinsic", None, "Traced", "synthetic-300"),
    (301, None, "intrinsic", None, "Traced", "synthetic-301"),
    (302, None, "intrinsic", None, "Traced", "synthetic-302"),
    (303, None, "intrinsic", None, "Traced", "synthetic-303"),  # confidence 0.49
    (304, None, "intrinsic", None, "Traced", "synthetic-304"),  # histamine
    (305, None, "intrinsic", None, "Traced", "synthetic-305"),
]

# bodyId → somaLocation. Body 302 (a selected interneuron) has none, to exercise the null path.
SOMA_LOCATIONS = {
    100: [1200, 3400, 560],
    101: [1210, 3410, 570],
    102: [1220, 3420, 580],
    200: [2100, 1800, 900],
    201: [2900, 1850, 905],
    202: [2110, 1790, 910],
    300: [1500, 2600, 740],
    301: [1520, 2610, 745],
    302: None,
    303: [1600, 2650, 760],
    304: [1650, 2700, 770],
    305: [1580, 2620, 750],
}

# body, predicted_nt, predicted_nt_confidence
TRANSMITTER_ROWS = [
    (100, "acetylcholine", 0.9),
    (101, "acetylcholine", 0.9),
    (102, "acetylcholine", 0.9),
    (200, "acetylcholine", 0.9),
    (201, "acetylcholine", 0.9),
    (202, "acetylcholine", 0.9),
    (300, "acetylcholine", 0.9),
    (301, "gaba", 0.8),
    (302, "glutamate", 0.7),
    (303, "acetylcholine", 0.49),
    (304, "histamine", 0.9),
    (305, "acetylcholine", 0.9),
]

# body_pre, body_post, weight (raw synapse count). Traced bodies only.
EDGE_ROWS = [
    (100, 300, 5),
    (100, 301, 3),
    (100, 302, 2),
    (100, 303, 4),
    (100, 304, 2),
    (100, 305, 1),
    (101, 300, 1),
    (300, 201, 4),
    (301, 201, 2),
    (302, 200, 3),
    (303, 201, 1),
    (303, 200, 1),
    (305, 200, 1),
]

EXPECT = {
    "annotationRows": len(ANNOTATION_ROWS),
    "edgeRows": len(EDGE_ROWS),
    "neurotransmitterRows": len(TRANSMITTER_ROWS),
}

CONFIG = {
    "formatVersion": 2,
    "datasetRelease": "synthetic-test-fixture",
    "edgeVariant": "traced-only",
    "expect": EXPECT,
    "sensory": {"class": "ALPN", "status": "Traced"},
    "readouts": {"superclass": "descending_neuron", "status": "Traced", "somaSides": ["L", "R"]},
    "transmitterSign": {"acetylcholine": 1, "gaba": -1, "glutamate": -1},
    "minConfidence": 0.5,
    "synapseCap": 5,
    "minInterneurons": 2,
    "maxInterneurons": 2,
    "expectedNeuronCount": 5,
    "capabilities": {
        "signals": ["spikes"],
        "channels": {
            "inputs": [{"id": "food-odour", "label": "Food odour", "side": "both", "neuron": 0, "range": [0, 1]}],
            "outputs": [
                {"id": "left-motor", "label": "Left motor", "side": "L", "neuron": 1, "range": [0, 1], "drive": "left"},
                {"id": "right-motor", "label": "Right motor", "side": "R", "neuron": 2, "range": [0, 1], "drive": "right"},
            ],
        },
    },
}


def write_dataset(directory):
    """Write the three synthetic Feather files into `directory`."""
    os.makedirs(directory, exist_ok=True)
    annotations = pa.table({
        "bodyId": [r[0] for r in ANNOTATION_ROWS],
        "class": [r[1] for r in ANNOTATION_ROWS],
        "superclass": [r[2] for r in ANNOTATION_ROWS],
        "somaSide": [r[3] for r in ANNOTATION_ROWS],
        "somaLocation": [SOMA_LOCATIONS[r[0]] for r in ANNOTATION_ROWS],
        "status": [r[4] for r in ANNOTATION_ROWS],
        "type": [r[5] for r in ANNOTATION_ROWS],
    })
    transmitters = pa.table({
        "body": [r[0] for r in TRANSMITTER_ROWS],
        "predicted_nt": [r[1] for r in TRANSMITTER_ROWS],
        "predicted_nt_confidence": [r[2] for r in TRANSMITTER_ROWS],
    })
    edges = pa.table({
        "body_pre": [r[0] for r in EDGE_ROWS],
        "body_post": [r[1] for r in EDGE_ROWS],
        "weight": [r[2] for r in EDGE_ROWS],
    })
    feather.write_feather(annotations, os.path.join(directory, ANNOTATIONS))
    feather.write_feather(transmitters, os.path.join(directory, NEUROTRANSMITTERS))
    feather.write_feather(edges, os.path.join(directory, EDGES))


def write_fixture_container(path):
    """Write the hand-checked container for the synthetic dataset.

    Selection by hand (ADR 002 with maxInterneurons 2, reserved slots R3):
      sensory 100 (ALPN, largest admitted out-synapses 11)
      LEFT 200, RIGHT 201
      candidates 300 (score 4, RIGHT), 301 (score 2, RIGHT, gaba),
                 302 (score 2, LEFT, glutamate), 305 (score 1, LEFT)
      reserved: best LEFT reacher 302, best RIGHT reacher 300; no free slots.
    Induced edges: 100→300 (5), 100→302 (2), 300→201 (4), 302→200 (3).
    Weights: sign × min(s, 5) ÷ 5; 302 is glutamate, sign −1.
    """
    neurons = [
        {"index": 0, "role": "sensory", "bodyId": 100, "class": "ALPN", "type": "synthetic-alpn-a",
         "somaSide": None, "superclass": "ascending_neuron", "soma": SOMA_LOCATIONS[100],
         "transmitter": "acetylcholine", "transmitterConfidence": 0.9, "sign": 1},
        {"index": 1, "role": "left", "bodyId": 200, "class": None, "type": "synthetic-dn-l",
         "somaSide": "L", "superclass": "descending_neuron", "soma": SOMA_LOCATIONS[200],
         "transmitter": "acetylcholine", "transmitterConfidence": 0.9, "sign": 1},
        {"index": 2, "role": "right", "bodyId": 201, "class": None, "type": "synthetic-dn-r",
         "somaSide": "R", "superclass": "descending_neuron", "soma": SOMA_LOCATIONS[201],
         "transmitter": "acetylcholine", "transmitterConfidence": 0.9, "sign": 1},
        {"index": 3, "role": "interneuron", "bodyId": 300, "class": None, "type": "synthetic-300",
         "somaSide": None, "superclass": "intrinsic", "soma": SOMA_LOCATIONS[300],
         "transmitter": "acetylcholine", "transmitterConfidence": 0.9, "sign": 1},
        {"index": 4, "role": "interneuron", "bodyId": 302, "class": None, "type": "synthetic-302",
         "somaSide": None, "superclass": "intrinsic", "soma": SOMA_LOCATIONS[302],
         "transmitter": "glutamate", "transmitterConfidence": 0.7, "sign": -1},
    ]
    # CSR, rows by presynaptic index then postsynaptic index.
    offsets = [0, 2, 2, 2, 3, 4]
    targets = [3, 4, 2, 1]
    synapses = [5, 2, 4, 3]
    signs = [n["sign"] for n in neurons]
    cap = CONFIG["synapseCap"]
    weights = []
    for pre, raw in zip(_sources(offsets), synapses):
        weights.append(signs[pre] * min(raw, cap) / cap)

    header = {
        "provenance": {
            "datasetRelease": CONFIG["datasetRelease"],
            "edgeVariant": CONFIG["edgeVariant"],
            "minConfidence": CONFIG["minConfidence"],
            "configHash": config_hash(CONFIG),
            "toolVersion": "0.1.0",
            "createdAt": "1970-01-01T00:00:00Z",
            "positionSource": "body-annotations-male-cns-v1.0-minconf-0.5.feather:somaLocation",
        },
        "synapseCap": cap,
        "neuronCount": len(neurons),
        "edgeCount": len(targets),
        "neurons": neurons,
        "capabilities": CONFIG["capabilities"],
    }
    return write_container(path, header, offsets, targets, weights, synapses)


def _sources(offsets):
    """The presynaptic index of each edge, from the CSR offsets."""
    sources = []
    for pre in range(len(offsets) - 1):
        sources += [pre] * (offsets[pre + 1] - offsets[pre])
    return sources


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("dataset_dir", help="directory to write the synthetic Feather files into")
    parser.add_argument("--container", default=os.path.normpath(CONTAINER_PATH))
    args = parser.parse_args(argv)

    write_dataset(args.dataset_dir)
    size = write_fixture_container(args.container)
    os.makedirs(FIXTURE_DIR, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as handle:
        json.dump(CONFIG, handle, indent=2)
        handle.write("\n")
    print(f"dataset   {args.dataset_dir}")
    print(f"container {args.container} ({size} bytes)")
    print(f"config    {CONFIG_PATH}")


if __name__ == "__main__":
    main()
