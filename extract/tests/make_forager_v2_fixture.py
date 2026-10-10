"""Synthetic forager-v2 fixture, not connectome data (Constitution III).

Writes tests/fixtures/forager-15k-synthetic.json: a small, hand-built MaleCNS-shaped table exercising all six
ADR 006 D8 input pools, at least two (pathway, outputGroup) pairs, the ALLN anchor class, a transmitter row under
each of ground_truth/consensus_nt/predicted_nt, an output with no resolved transmitter (sign 0, D9's rule), and a
candidate (4007) that would be selected by flow alone but is removed by the default excludeInterneuronClasses list
(D12) — demonstrating the exclusion rule without a config mutation.

  odour-food   left 1001 (predicted_nt), right 2001 (ground_truth)              -> interneuron 4003 -> forward
  odour-danger left 1002 (consensus_nt), right 2002 (predicted_nt)              -> 4001 (anchor) -> backward
                                                                                 -> 4006 -> escape
  heat         left 1003, right 2003                                           -> 4005 (adds to touch's flow)
  taste-mouth  left 1004, right 2004                                           -> 4004 (gaba, sign -1) -> feed
  taste-leg    left 1005, right 2005                                           -> 4004 -> feed
  touch        left 1006, right 2006                                           -> 4005 -> turn-left/turn-right
  output       turn-left 3001, turn-right 3002, forward 3003, backward 3004,
               feed 3005, escape 3006 (sign 0: predicted_nt "unclear" 0.3)
  interneuron  4001 ALLN (anchor), 4003, 4004 (gaba), 4005, 4006 (reached by flow)
  excluded     4007 (class olfactory, reached by (odour-food, forward) flow, removed by excludeInterneuronClasses)
  not admitted 5001 (status Orphan)

Run from extract/:  python tests/make_forager_v2_fixture.py
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "fixtures", "forager-15k-synthetic.json")

ODOUR_FOOD_TYPES = ["ORN_DM1", "ORN_DM2", "ORN_DM4", "ORN_VA2", "ORN_VM2", "ORN_DP1m"]
ODOUR_DANGER_TYPES = ["ORN_V", "ORN_DA2"]


def config():
    return {
        "formatVersion": 4,
        "kind": "forager",
        "datasetRelease": "synthetic",
        "edgeVariant": "traced-only",
        "expect": {"annotationRows": 0, "edgeRows": 0, "neurotransmitterRows": 0},
        "transmitterSign": {"acetylcholine": 1, "gaba": -1, "glutamate": -1},
        "transmitterSource": ["ground_truth", "consensus_nt", "predicted_nt"],
        "minConfidence": 0.5,
        "inputs": {
            "odour-food-left": {"class": "olfactory", "types": ODOUR_FOOD_TYPES, "rootSide": "L"},
            "odour-food-right": {"class": "olfactory", "types": ODOUR_FOOD_TYPES, "rootSide": "R"},
            "odour-danger-left": {"class": "olfactory", "types": ODOUR_DANGER_TYPES, "rootSide": "L"},
            "odour-danger-right": {"class": "olfactory", "types": ODOUR_DANGER_TYPES, "rootSide": "R"},
            "heat-left": {"class": "thermosensory", "types": ["TRN_VP2"], "rootSide": "L"},
            "heat-right": {"class": "thermosensory", "types": ["TRN_VP2"], "rootSide": "R"},
            "taste-mouth-left": {"class": "gustatory", "subclasses": ["labellar bristle", "taste peg"],
                                  "rootSide": "L"},
            "taste-mouth-right": {"class": "gustatory", "subclasses": ["labellar bristle", "taste peg"],
                                   "rootSide": "R"},
            "taste-leg-left": {"class": "gustatory", "subclasses": ["leg bristle"], "entryNerve": "ProLN",
                                "rootSide": "L"},
            "taste-leg-right": {"class": "gustatory", "subclasses": ["leg bristle"], "entryNerve": "ProLN",
                                 "rootSide": "R"},
            "touch-left": {"class": "mechanosensory_tactile", "entryNerve": "ProLN", "rootSide": "L"},
            "touch-right": {"class": "mechanosensory_tactile", "entryNerve": "ProLN", "rootSide": "R"},
        },
        "sideMatch": {
            "odour-food": True, "odour-danger": True, "heat": True,
            "taste-mouth": False, "taste-leg": False, "touch": True,
        },
        "outputs": {
            "turn-left": {"types": ["DNa01"], "somaSide": "L", "drive": "turnLeft"},
            "turn-right": {"types": ["DNa01"], "somaSide": "R", "drive": "turnRight"},
            "forward": {"types": ["DNp09"], "drive": "forward"},
            "backward": {"types": ["MDN"], "drive": "backward"},
            "feed": {"types": ["MN9"], "drive": "feed"},
            "escape": {"types": ["DNp01"], "drive": "escape"},
        },
        "pathways": {
            "odour-food": ["odour-food-left", "odour-food-right"],
            "odour-danger": ["odour-danger-left", "odour-danger-right"],
            "heat": ["heat-left", "heat-right"],
            "taste-mouth": ["taste-mouth-left", "taste-mouth-right"],
            "taste-leg": ["taste-leg-left", "taste-leg-right"],
            "touch": ["touch-left", "touch-right"],
        },
        "outputGroups": {
            "turn": ["turn-left", "turn-right"],
            "forward": ["forward"],
            "backward": ["backward"],
            "feed": ["feed"],
            "escape": ["escape"],
        },
        "flowSteps": 4,
        "budget": {"perPair": 3},
        "anchors": [{"class": "ALLN"}],
        "excludeInterneuronClasses": ["olfactory", "gustatory", "thermosensory", "mechanosensory_tactile"],
        "excludeInterneuronSuperclassSuffix": "_sensory",
        "weightRule": "synapseCount",
        "minSynapses": 1,
        "modulators": [
            {"id": "hunger", "label": "Hunger", "range": [0, 1], "gain": [0.5, 1.5],
             "targets": ["odour-food-left", "odour-food-right"]},
            {"id": "hunger-taste", "label": "Hunger taste", "source": "hunger", "gain": [0.1, 1.5],
             "targets": ["taste-mouth-left", "taste-mouth-right", "taste-leg-left", "taste-leg-right"]},
        ],
        "capabilities": {
            "signals": ["spikes"],
            "channels": {
                "inputs": [
                    {"id": "odour-food-left", "label": "Odour food left", "side": "L", "sense": "odour:food",
                     "site": "antenna", "range": [0, 1]},
                    {"id": "odour-food-right", "label": "Odour food right", "side": "R", "sense": "odour:food",
                     "site": "antenna", "range": [0, 1]},
                    {"id": "odour-danger-left", "label": "Odour danger left", "side": "L", "sense": "odour:danger",
                     "site": "antenna", "range": [0, 1]},
                    {"id": "odour-danger-right", "label": "Odour danger right", "side": "R",
                     "sense": "odour:danger", "site": "antenna", "range": [0, 1]},
                    {"id": "heat-left", "label": "Heat left", "side": "L", "sense": "heat", "site": "antenna",
                     "range": [0, 1]},
                    {"id": "heat-right", "label": "Heat right", "side": "R", "sense": "heat", "site": "antenna",
                     "range": [0, 1]},
                    {"id": "taste-mouth-left", "label": "Taste mouth left", "side": "L", "sense": "taste:mouth",
                     "site": "mouth", "range": [0, 1]},
                    {"id": "taste-mouth-right", "label": "Taste mouth right", "side": "R", "sense": "taste:mouth",
                     "site": "mouth", "range": [0, 1]},
                    {"id": "taste-leg-left", "label": "Taste leg left", "side": "L", "sense": "taste:leg",
                     "site": "front-leg", "range": [0, 1]},
                    {"id": "taste-leg-right", "label": "Taste leg right", "side": "R", "sense": "taste:leg",
                     "site": "front-leg", "range": [0, 1]},
                    {"id": "touch-left", "label": "Touch left", "side": "L", "sense": "touch", "site": "front-leg",
                     "range": [0, 1]},
                    {"id": "touch-right", "label": "Touch right", "side": "R", "sense": "touch",
                     "site": "front-leg", "range": [0, 1]},
                ],
                "outputs": [
                    {"id": "turn-left", "label": "Turn left", "side": "L", "range": [0, 1], "drive": "turnLeft"},
                    {"id": "turn-right", "label": "Turn right", "side": "R", "range": [0, 1], "drive": "turnRight"},
                    {"id": "forward", "label": "Forward", "side": "both", "range": [0, 1], "drive": "forward"},
                    {"id": "backward", "label": "Backward", "side": "both", "range": [0, 1], "drive": "backward"},
                    {"id": "feed", "label": "Feed", "side": "both", "range": [0, 1], "drive": "feed"},
                    {"id": "escape", "label": "Escape", "side": "both", "range": [0, 1], "drive": "escape"},
                ],
            },
        },
        "neuronCountRange": [1, 100],
    }


# bodyId, class, superclass, somaSide, status, type, rootSide, subclass, entryNerve
BODIES = [
    (1001, "olfactory", "sensory", None, "Traced", "ORN_DM1", "L", None, None),
    (2001, "olfactory", "sensory", None, "Traced", "ORN_DM1", "R", None, None),
    (1002, "olfactory", "sensory", None, "Traced", "ORN_V", "L", None, None),
    (2002, "olfactory", "sensory", None, "Traced", "ORN_V", "R", None, None),
    (1003, "thermosensory", "sensory", None, "Traced", "TRN_VP2", "L", None, None),
    (2003, "thermosensory", "sensory", None, "Traced", "TRN_VP2", "R", None, None),
    (1004, "gustatory", "sensory", None, "Traced", "LgLG1", "L", "labellar bristle", None),
    (2004, "gustatory", "sensory", None, "Traced", "LgLG1", "R", "labellar bristle", None),
    (1005, "gustatory", "sensory", None, "Traced", "LegGRN", "L", "leg bristle", "ProLN"),
    (2005, "gustatory", "sensory", None, "Traced", "LegGRN", "R", "leg bristle", "ProLN"),
    (1006, "mechanosensory_tactile", "sensory", None, "Traced", "TactileGRN", "L", None, "ProLN"),
    (2006, "mechanosensory_tactile", "sensory", None, "Traced", "TactileGRN", "R", None, "ProLN"),
    (3001, "descending", "descending_neuron", "L", "Traced", "DNa01", None, None, None),
    (3002, "descending", "descending_neuron", "R", "Traced", "DNa01", None, None, None),
    (3003, "descending", "descending_neuron", None, "Traced", "DNp09", None, None, None),
    (3004, "descending", "descending_neuron", None, "Traced", "MDN", None, None, None),
    (3005, "motor", "vnc_motor", None, "Traced", "MN9", None, None, None),
    (3006, "descending", "descending_neuron", None, "Traced", "DNp01", None, None, None),
    (4001, "ALLN", "al_local", None, "Traced", "ALLN_1", None, None, None),
    (4003, "intrinsic", "cb_intrinsic", None, "Traced", "INT_A", None, None, None),
    (4004, "intrinsic", "cb_intrinsic", None, "Traced", "INT_B", None, None, None),
    (4005, "intrinsic", "vnc_intrinsic", None, "Traced", "INT_C", None, None, None),
    (4006, "intrinsic", "descending_neuron", None, "Traced", "INT_D", None, None, None),
    (4007, "olfactory", "sensory_ascending", None, "Traced", "INT_E", None, None, None),
    (5001, "intrinsic", "cb_intrinsic", None, "Orphan", "INT_F", None, None, None),
]

# bodyId -> (ground_truth, consensus_nt, predicted_nt, predicted_nt_confidence)
TRANSMITTERS = {
    1001: (None, None, "acetylcholine", 0.9),
    2001: ("acetylcholine", None, None, None),
    1002: (None, "acetylcholine", None, None),
    2002: (None, None, "acetylcholine", 0.9),
    1003: (None, None, "acetylcholine", 0.9),
    2003: (None, None, "acetylcholine", 0.9),
    1004: (None, None, "acetylcholine", 0.9),
    2004: (None, None, "acetylcholine", 0.9),
    1005: (None, None, "acetylcholine", 0.9),
    2005: (None, None, "acetylcholine", 0.9),
    1006: (None, None, "acetylcholine", 0.9),
    2006: (None, None, "acetylcholine", 0.9),
    3001: (None, None, "acetylcholine", 0.9),
    3002: (None, None, "acetylcholine", 0.9),
    3003: (None, None, "acetylcholine", 0.9),
    3004: (None, None, "acetylcholine", 0.9),
    3005: (None, None, "acetylcholine", 0.9),
    3006: (None, None, "unclear", 0.3),
    4001: (None, None, "acetylcholine", 0.9),
    4003: (None, None, "acetylcholine", 0.9),
    4004: (None, None, "gaba", 0.9),
    4005: (None, None, "acetylcholine", 0.9),
    4006: (None, None, "acetylcholine", 0.9),
    4007: (None, None, "acetylcholine", 0.9),
}

INPUTS = [1001, 2001, 1002, 2002, 1003, 2003, 1004, 2004, 1005, 2005, 1006, 2006]
HUBS = [4003, 4004, 4005, 4006]
OUTPUTS = [3001, 3002, 3003, 3004, 3005, 3006]

# A dense input→hub→output mesh (syn=1 each way) so every one of the 30 (pathway, outputGroup) pairs has a
# positive-scoring candidate in this small graph (every hub is one hop from every input and every output), plus a
# few distinctive edges: the ALLN anchor (4001, included regardless of score), the excluded candidate (4007,
# reached by flow but removed by the default excludeInterneuronClasses), the output-outgoing "sink" edges that
# must be dropped before the flows run, and an edge into the non-admitted Orphan body (5001).
EDGES = (
    [(i, h, 2) for i in INPUTS for h in HUBS]
    + [(h, o, 2) for h in HUBS for o in OUTPUTS]
    + [
        (1002, 4001, 1), (2002, 4001, 1), (4001, 3004, 1),  # anchor's own edges: syn=1, dropped at minSynapses 2
        (2001, 4007, 5), (4007, 3003, 3),
        (3003, 4003, 1), (3005, 4004, 1),
        (1001, 5001, 2),
    ]
)


def build():
    annotations, transmitters = [], []
    for body, cls, superclass, side, status, type_, root, subclass, entry in BODIES:
        annotations.append({
            "bodyId": body, "class": cls, "superclass": superclass, "somaSide": side,
            "somaLocation": None, "status": status, "type": type_,
            "rootSide": root, "subclass": subclass, "receptorType": None, "entryNerve": entry,
        })
    for body, (ground_truth, consensus_nt, predicted_nt, confidence) in TRANSMITTERS.items():
        transmitters.append({
            "body": body, "ground_truth": ground_truth, "consensus_nt": consensus_nt,
            "predicted_nt": predicted_nt, "predicted_nt_confidence": confidence,
        })
    return {
        "synthetic": True,
        "note": "Hand-built forager-v2 fixture (Constitution III). Not connectome data. "
                "See make_forager_v2_fixture.py.",
        "config": config(),
        "annotations": annotations,
        "transmitters": transmitters,
        "edges": {
            "pre": [e[0] for e in EDGES],
            "post": [e[1] for e in EDGES],
            "synapses": [e[2] for e in EDGES],
        },
    }


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(build(), handle, indent=2, sort_keys=True)
        handle.write("\n")
    print(OUT)


if __name__ == "__main__":
    main()
