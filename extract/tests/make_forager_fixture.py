"""Synthetic forager fixture, not connectome data (Constitution III).

Writes tests/fixtures/forager-synthetic.json: a labelled, hand-built MaleCNS-shaped table (annotation rows,
neurotransmitter rows and traced-only edges) and the format 3 config that reads it. The fixture is small enough to
check the rules by hand:

  odour  ORN_DM1 L 101, R 201; ORN_DM2 L 102 and 103, R 202 (103 is unmatched by side matching);
         ORN_X L 104 (not a food type); extra edges into interneurons
  taste  labellar bristle L 301, R 302; leg GRN L 303 (not a taste pool, so an excluded sensory class)
  output DNa01 L 401, R 402; DNa02 L 403, R 404; DNp09 405; MDN 406; MN9 407 (unclear transmitter, sign 0)
  inter  501, 502, 503, 504 (traced, mapped transmitters), 506 (no path to any output), 505 (visual sensory)
  other  507 (status Orphan, so not admitted; its edge is ignored)

  pathwayBias fixture (012-pathway-aware-selection, ADR 003 D3'): 301 (taste-left) -> 509 -> 508 -> 405 (forward),
  508 also fans most of its output into 506 (the existing no-path body) so plain backward flow -- seeded at 405
  itself -- dilutes to a small fraction at 508/509, while a pathwayBias rule seeded directly at 508 (sign -1, an
  edge into forward) does not. 510 -> 508 has no inflow of its own (zero forward flow from either pathway), so it
  stays unadmitted under the rule however strong its rule-seeded backward flow is (FR-004).

Run from extract/:  python tests/make_forager_fixture.py
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "fixtures", "forager-synthetic.json")

ODOUR_TYPES = ["ORN_DM1", "ORN_DM2"]
TASTE_SUBCLASSES = ["labellar bristle", "taste peg"]
OUTPUT_TYPES = {
    "turn-left": ["DNa01", "DNa02"], "turn-right": ["DNa01", "DNa02"],
    "forward": ["DNp09"], "backward": ["MDN"], "feed": ["MN9"],
}


def config():
    return {
        "formatVersion": 3,
        "kind": "forager",
        "datasetRelease": "synthetic",
        "edgeVariant": "traced-only",
        "expect": {"annotationRows": 0, "edgeRows": 0, "neurotransmitterRows": 0},
        "transmitterSign": {"acetylcholine": 1, "gaba": -1, "glutamate": -1},
        "minConfidence": 0.5,
        "synapseCap": 65535,
        "inputs": {
            "odour-left": {"class": "olfactory", "types": ODOUR_TYPES, "rootSide": "L"},
            "odour-right": {"class": "olfactory", "types": ODOUR_TYPES, "rootSide": "R"},
            "taste-left": {"class": "gustatory", "subclasses": TASTE_SUBCLASSES, "typePrefixes": ["LgLG"],
                           "rootSide": "L"},
            "taste-right": {"class": "gustatory", "subclasses": TASTE_SUBCLASSES, "typePrefixes": ["LgLG"],
                            "rootSide": "R"},
        },
        "sideMatch": {"odour": True, "taste": False},
        "outputs": {
            "turn-left": {"types": OUTPUT_TYPES["turn-left"], "somaSide": "L", "drive": "turnLeft"},
            "turn-right": {"types": OUTPUT_TYPES["turn-right"], "somaSide": "R", "drive": "turnRight"},
            "forward": {"types": OUTPUT_TYPES["forward"], "drive": "forward"},
            "backward": {"types": OUTPUT_TYPES["backward"], "drive": "backward"},
            "feed": {"types": OUTPUT_TYPES["feed"], "drive": "feed"},
        },
        "pathways": {"odour": ["odour-left", "odour-right"], "taste": ["taste-left", "taste-right"]},
        "flowSteps": 5,
        "budget": {"odour": 3, "taste": 3},
        "excludeInterneuronClasses": ["olfactory", "gustatory", "visual"],
        "excludeInterneuronSuperclassSuffix": "_sensory",
        "weightRule": "postFraction",
        "outputAdmission": "low-confidence-sign-zero",
        "pathwayBias": [],
        "modulators": [
            {"id": "hunger", "label": "Hunger", "range": [0, 1], "gain": [0.5, 1.5],
             "targets": ["odour-left", "odour-right"]},
            {"id": "hunger-taste", "label": "Hunger taste", "source": "hunger", "gain": [0.1, 1.5],
             "targets": ["taste-left", "taste-right"]},
        ],
        "capabilities": {
            "signals": ["spikes"],
            "channels": {
                "inputs": [
                    {"id": "odour-left", "label": "Odour left", "side": "L", "range": [0, 1]},
                    {"id": "odour-right", "label": "Odour right", "side": "R", "range": [0, 1]},
                    {"id": "taste-left", "label": "Taste left", "side": "L", "range": [0, 1]},
                    {"id": "taste-right", "label": "Taste right", "side": "R", "range": [0, 1]},
                ],
                "outputs": [
                    {"id": "turn-left", "label": "Turn left", "side": "L", "range": [0, 1], "drive": "turnLeft"},
                    {"id": "turn-right", "label": "Turn right", "side": "R", "range": [0, 1], "drive": "turnRight"},
                    {"id": "forward", "label": "Forward", "side": "both", "range": [0, 1], "drive": "forward"},
                    {"id": "backward", "label": "Backward", "side": "both", "range": [0, 1], "drive": "backward"},
                    {"id": "feed", "label": "Feed", "side": "both", "range": [0, 1], "drive": "feed"},
                ],
            },
        },
        "expectedNeuronCount": None,
        "neuronCountRange": [1, 100],
    }


# bodyId, class, superclass, somaSide, status, type, rootSide, subclass, receptorType, transmitter, confidence,
# soma. `somaSide` is None for bodies without a soma side (olfactory and gustatory bodies have only rootSide).
BODIES = [
    (101, "olfactory", "sensory", None, "Traced", "ORN_DM1", "L", None, "putative_ppk25", "acetylcholine", 0.9),
    (201, "olfactory", "sensory", None, "Traced", "ORN_DM1", "R", None, "putative_ppk25", "acetylcholine", 0.9),
    (102, "olfactory", "sensory", None, "Traced", "ORN_DM2", "L", None, "putative_IR52b", "acetylcholine", 0.8),
    (202, "olfactory", "sensory", None, "Traced", "ORN_DM2", "R", None, "putative_IR52b", "acetylcholine", 0.8),
    (103, "olfactory", "sensory", None, "Traced", "ORN_DM2", "L", None, "putative_IR52b", "acetylcholine", 0.8),
    (104, "olfactory", "sensory", None, "Traced", "ORN_X", "L", None, "putative_ppk23", "acetylcholine", 0.9),
    (301, "gustatory", "sensory", None, "Traced", "LgLG1", "L", "labellar bristle", "putative_ppk23", "acetylcholine", 0.9),
    (302, "gustatory", "sensory", None, "Traced", "LgLG1", "R", "labellar bristle", "putative_ppk23", "acetylcholine", 0.9),
    (303, "gustatory", "sensory", None, "Traced", "LegGRN", "L", "leg", "putative_ppk25", "acetylcholine", 0.9),
    (401, "descending", "descending", "L", "Traced", "DNa01", None, None, None, "acetylcholine", 0.95),
    (402, "descending", "descending", "R", "Traced", "DNa01", None, None, None, "acetylcholine", 0.95),
    (403, "descending", "descending", "L", "Traced", "DNa02", None, None, None, "acetylcholine", 0.95),
    (404, "descending", "descending", "R", "Traced", "DNa02", None, None, None, "acetylcholine", 0.95),
    (405, "descending", "descending", None, "Traced", "DNp09", None, None, None, "acetylcholine", 0.95),
    (406, "descending", "descending", None, "Traced", "MDN", None, None, None, "acetylcholine", 0.9),
    (407, "motor", "motor", None, "Traced", "MN9", None, None, None, "unclear", 0.49),
    (501, "intrinsic", "central", None, "Traced", "INT_A", None, None, None, "acetylcholine", 0.9),
    (502, "intrinsic", "central", None, "Traced", "INT_B", None, None, None, "gaba", 0.9),
    (503, "intrinsic", "central", None, "Traced", "INT_C", None, None, None, "acetylcholine", 0.9),
    (504, "intrinsic", "central", None, "Traced", "INT_D", None, None, None, "acetylcholine", 0.9),
    (505, "visual", "visual_sensory", None, "Traced", "VIS_1", None, None, None, "acetylcholine", 0.9),
    (506, "intrinsic", "central", None, "Traced", "INT_E", None, None, None, "acetylcholine", 0.9),
    (507, "intrinsic", "central", None, "Orphan", "INT_F", None, None, None, "acetylcholine", 0.9),
    (508, "intrinsic", "central", None, "Traced", "INT_BRAKE", None, None, None, "gaba", 0.9),
    (509, "intrinsic", "central", None, "Traced", "INT_UP", None, None, None, "acetylcholine", 0.9),
    (510, "intrinsic", "central", None, "Traced", "INT_ZERO", None, None, None, "acetylcholine", 0.9),
]

# (pre, post, synapses)
EDGES = [
    (101, 501, 3), (201, 501, 2), (102, 502, 2), (202, 503, 2), (103, 502, 1), (104, 501, 1),
    (301, 504, 3), (302, 503, 2), (301, 502, 1), (303, 501, 5), (505, 501, 3),
    (501, 502, 2), (502, 504, 2), (503, 504, 1),
    (501, 401, 4), (502, 403, 3), (503, 402, 4), (504, 404, 3), (501, 405, 2), (503, 406, 2), (504, 407, 1),
    (401, 501, 1), (407, 504, 2),
    (101, 507, 2),
    # pathwayBias fixture (ADR 003 D3'): 301 (taste-left) -> 509 -> 508 -> 405 (forward's own body), 508's output
    # mostly dumped into the no-path body 506 to dilute plain backward flow; 510 -> 508 has no inflow of its own.
    (301, 509, 4), (509, 508, 1), (508, 405, 1), (508, 506, 19), (510, 508, 1),
]


def build():
    annotations = []
    transmitters = []
    for body, cls, superclass, side, status, type_, root, subclass, receptor, nt, confidence in BODIES:
        annotations.append({
            "bodyId": body, "class": cls, "superclass": superclass, "somaSide": side,
            "somaLocation": None, "status": status, "type": type_,
            "rootSide": root, "subclass": subclass, "receptorType": receptor,
        })
        transmitters.append({"body": body, "predicted_nt": nt, "predicted_nt_confidence": confidence})
    return {
        "synthetic": True,
        "note": "Hand-built forager fixture (Constitution III). Not connectome data. See make_forager_fixture.py. "
                "Extended for 012-pathway-aware-selection: bodies 508-510 and their edges exercise the "
                "pathwayBias rule (ADR 003 D3').",
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
