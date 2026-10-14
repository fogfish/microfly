"""Synthetic wide-I/O class-seed fixture (ADR 007 D15-D20), not connectome data (Constitution III).

Writes tests/fixtures/forager-wide-synthetic.json: a labelled, hand-built table and the format 5
kind:"forager-wide" selection:"classSeed" config that reads it. All twelve input channels and six outputs are
represented, with bodies covering the new filter keys and a known pair-matched L/R split:

  odour-food   101 (L), 201 (R)                               -- matched, trivially 1:1
  odour-danger 102 (L), 202 (R)                                -- matched, trivially 1:1
  heat         103 (L), 203 (R)                                -- matched, trivially 1:1
  taste-mouth  301, 310 (L, not side-matched), 302 (R)         -- sideMatch false, both L bodies kept
  taste-leg    401 (L, kept), 402 (L, excludeReceptorTypes ppk -- not matched at all), 403 (R, kept),
               404 (L, wrong entryNerve -- not matched at all)
  touch        501 (L, type T1), 510 (L, type T2), 502 (R, type T1) -- side-matched per type: T1 keeps
               501/502 (min 1,1); T2 drops 510 (min 1,0)

  turn-left 601, turn-right 602, forward 603, backward 604, feed 605, escape 606
  central seed 701 (class SEEDCLS); fill.neuronCount is exactly seeds+pools, so nothing else is selected
  (402, 404, 510 and 710 stay admitted but unselected)

Edges are placed so the probe's steps=1 values are hand-computable (see test_selection_class_seed_wide.py's
module docstring for the derivation): each pair's L/R channel feeds turn-left/turn-right with a distinct,
dedicated synapse count, so the shared "absolute" denominator at each output body is still arithmetic a reader
can check by hand.

Run from extract/:  python tests/make_forager_wide_fixture.py
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "fixtures", "forager-wide-synthetic.json")


def config():
    return {
        "formatVersion": 5,
        "kind": "forager-wide",
        "selection": "classSeed",
        "datasetRelease": "synthetic",
        "edgeVariant": "traced-only",
        "expect": {"annotationRows": 0, "edgeRows": 0, "neurotransmitterRows": 0},
        "admission": "allTraced",
        "transmitterColumn": "consensus_nt",
        "transmitterSign": {"gaba": -1, "glutamate": -1},
        "defaultSign": 1,
        "minSynapses": 5,
        "seeds": [
            {"class": ["SEEDCLS"]},
        ],
        "fill": {
            "neuronCount": 20,
            "excludeClasses": ["olfactory", "gustatory"],
            "excludeSuperclassSuffix": "_sensory",
            "excludeSuperclasses": ["vnc_motor", "cb_motor"],
        },
        "inputs": {
            "odour-food-left": {"pair": "odour-food", "class": "olfactory", "types": ["ORN_FOOD"], "rootSide": "L"},
            "odour-food-right": {"pair": "odour-food", "class": "olfactory", "types": ["ORN_FOOD"], "rootSide": "R"},
            "odour-danger-left": {"pair": "odour-danger", "class": "olfactory", "types": ["ORN_DANGER"], "rootSide": "L"},
            "odour-danger-right": {"pair": "odour-danger", "class": "olfactory", "types": ["ORN_DANGER"], "rootSide": "R"},
            "heat-left": {"pair": "heat", "class": "thermosensory", "types": ["TRN_HEAT"], "rootSide": "L"},
            "heat-right": {"pair": "heat", "class": "thermosensory", "types": ["TRN_HEAT"], "rootSide": "R"},
            "taste-mouth-left": {"pair": "taste-mouth", "class": "gustatory", "subclasses": ["labellar bristle"], "rootSide": "L"},
            "taste-mouth-right": {"pair": "taste-mouth", "class": "gustatory", "subclasses": ["labellar bristle"], "rootSide": "R"},
            "taste-leg-left": {
                "pair": "taste-leg", "class": "gustatory", "subclasses": ["leg bristle"],
                "entryNerves": ["ProLN"], "excludeReceptorTypes": ["putative_ppk23"], "rootSide": "L",
            },
            "taste-leg-right": {
                "pair": "taste-leg", "class": "gustatory", "subclasses": ["leg bristle"],
                "entryNerves": ["ProLN"], "excludeReceptorTypes": ["putative_ppk23"], "rootSide": "R",
            },
            "touch-left": {"pair": "touch", "class": "mechanosensory_tactile", "types": ["T1", "T2"], "rootSide": "L"},
            "touch-right": {"pair": "touch", "class": "mechanosensory_tactile", "types": ["T1", "T2"], "rootSide": "R"},
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
        "weightRule": "postFractionAbsolute",
        "modulators": [
            {"id": "hunger", "label": "Hunger", "range": [0, 1], "gain": [0.5, 1.5],
             "targets": ["odour-food-left", "odour-food-right"]},
        ],
        "capabilities": {
            "signals": ["spikes"],
            "channels": {
                "inputs": [
                    {"id": "odour-food-left", "label": "Food odour left", "side": "L", "range": [0, 1], "sense": "odour:food", "site": "antenna"},
                    {"id": "odour-food-right", "label": "Food odour right", "side": "R", "range": [0, 1], "sense": "odour:food", "site": "antenna"},
                    {"id": "odour-danger-left", "label": "Danger odour left", "side": "L", "range": [0, 1], "sense": "odour:danger", "site": "antenna"},
                    {"id": "odour-danger-right", "label": "Danger odour right", "side": "R", "range": [0, 1], "sense": "odour:danger", "site": "antenna"},
                    {"id": "heat-left", "label": "Heat left", "side": "L", "range": [0, 1], "sense": "heat", "site": "antenna"},
                    {"id": "heat-right", "label": "Heat right", "side": "R", "range": [0, 1], "sense": "heat", "site": "antenna"},
                    {"id": "taste-mouth-left", "label": "Mouth taste left", "side": "L", "range": [0, 1], "sense": "taste", "site": "mouth"},
                    {"id": "taste-mouth-right", "label": "Mouth taste right", "side": "R", "range": [0, 1], "sense": "taste", "site": "mouth"},
                    {"id": "taste-leg-left", "label": "Leg taste left", "side": "L", "range": [0, 1], "sense": "taste", "site": "front-leg"},
                    {"id": "taste-leg-right", "label": "Leg taste right", "side": "R", "range": [0, 1], "sense": "taste", "site": "front-leg"},
                    {"id": "touch-left", "label": "Touch left", "side": "L", "range": [0, 1], "sense": "touch", "site": "front-leg"},
                    {"id": "touch-right", "label": "Touch right", "side": "R", "range": [0, 1], "sense": "touch", "site": "front-leg"},
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
        "fidelity": {
            "require": False,
            "steps": 1,
            "checks": [
                {"kind": "contrast", "pair": "odour-food", "minFraction": 0.1},
                {"kind": "contrast", "pair": "heat", "minFraction": 0.1},
                {"kind": "contrast", "pair": "touch", "minFraction": 0.1},
                {"kind": "sign", "from": "taste-mouth", "to": "feed"},
                {"kind": "sign", "from": "taste-mouth", "to": "forward"},
                {"kind": "sign", "from": "taste-leg", "to": "backward"},
            ],
        },
        "neuronCountRange": [1, 100],
    }


# bodyId, class, superclass, somaSide, status, type, rootSide, subclass, receptorType, entryNerve, consensus_nt
BODIES = [
    (101, "olfactory", "sensory", None, "Traced", "ORN_FOOD", "L", None, None, None, "acetylcholine"),
    (201, "olfactory", "sensory", None, "Traced", "ORN_FOOD", "R", None, None, None, "acetylcholine"),
    (102, "olfactory", "sensory", None, "Traced", "ORN_DANGER", "L", None, None, None, "acetylcholine"),
    (202, "olfactory", "sensory", None, "Traced", "ORN_DANGER", "R", None, None, None, "acetylcholine"),
    (103, "thermosensory", "sensory", None, "Traced", "TRN_HEAT", "L", None, None, None, "acetylcholine"),
    (203, "thermosensory", "sensory", None, "Traced", "TRN_HEAT", "R", None, None, None, "acetylcholine"),
    (301, "gustatory", "sensory", None, "Traced", "LB_1", "L", "labellar bristle", None, None, "acetylcholine"),
    (310, "gustatory", "sensory", None, "Traced", "LB_2", "L", "labellar bristle", None, None, "gaba"),
    (302, "gustatory", "sensory", None, "Traced", "LB_1", "R", "labellar bristle", None, None, "acetylcholine"),
    (401, "gustatory", "sensory", None, "Traced", "LgLG_1", "L", "leg bristle", None, "ProLN", "acetylcholine"),
    (402, "gustatory", "sensory", None, "Traced", "LgLG_2", "L", "leg bristle", "putative_ppk23", "ProLN", "acetylcholine"),
    (403, "gustatory", "sensory", None, "Traced", "LgLG_1", "R", "leg bristle", None, "ProLN", "acetylcholine"),
    (404, "gustatory", "sensory", None, "Traced", "LgLG_3", "L", "leg bristle", None, "MesoLN", "acetylcholine"),
    (501, "mechanosensory_tactile", "sensory", None, "Traced", "T1", "L", None, None, "ProLN", "acetylcholine"),
    (510, "mechanosensory_tactile", "sensory", None, "Traced", "T2", "L", None, None, "ProLN", "acetylcholine"),
    (502, "mechanosensory_tactile", "sensory", None, "Traced", "T1", "R", None, None, "ProLN", "acetylcholine"),
    (601, "descending", "descending", "L", "Traced", "DNa01", None, None, None, None, "acetylcholine"),
    (602, "descending", "descending", "R", "Traced", "DNa01", None, None, None, None, "acetylcholine"),
    (603, "descending", "descending", None, "Traced", "DNp09", None, None, None, None, "acetylcholine"),
    (604, "descending", "descending", None, "Traced", "MDN", None, None, None, None, "acetylcholine"),
    (605, "motor", "motor", None, "Traced", "MN9", None, None, None, None, "acetylcholine"),
    (606, "descending", "descending", None, "Traced", "DNp01", None, None, None, None, "acetylcholine"),
    (701, "SEEDCLS", "central", None, "Traced", "SC_A", None, None, None, None, "acetylcholine"),
    (710, "intrinsic", "central", None, "Orphan", "INT_710", None, None, None, None, "acetylcholine"),
]

# (pre, post, synapses): each pair's L/R channel feeds turn-left/turn-right with its own dedicated weight, so
# the shared "absolute" denominator at 601/602 (10+5+5=20 each) is still hand-checkable (module docstring).
EDGES = [
    (101, 601, 10), (201, 602, 10),   # odour-food
    (103, 601, 5), (203, 602, 5),     # heat
    (501, 601, 5), (502, 602, 5),     # touch
    (301, 605, 9),                     # taste-mouth -> feed
    (310, 603, 6),                     # taste-mouth -> forward (gaba, sign -1)
    (401, 604, 7),                     # taste-leg -> backward
    (701, 606, 5),                     # escape needs >=1 real inflow edge (E-OUTPUT-UNREACHED)
]


def build():
    annotations = []
    transmitters = []
    for body, cls, superclass, soma_side, status, type_, root, subclass, receptor, entry_nerve, nt in BODIES:
        annotations.append({
            "bodyId": body, "class": cls, "superclass": superclass, "somaSide": soma_side,
            "somaLocation": None, "status": status, "type": type_,
            "rootSide": root, "subclass": subclass, "receptorType": receptor, "entryNerve": entry_nerve,
        })
        transmitters.append({"body": body, "consensus_nt": nt})
    return {
        "synthetic": True,
        "note": "Hand-built wide-I/O class-seed fixture (Constitution III). Not connectome data. "
                "See make_forager_wide_fixture.py.",
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
