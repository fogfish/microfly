"""Synthetic class-seeded fixture, not connectome data (Constitution III).

Writes tests/fixtures/class-seed-synthetic.json: a labelled, hand-built MaleCNS-shaped table (annotation rows,
"consensus_nt" transmitter rows, traced-only edges at various synapse counts) and the format 4
selection:"classSeed" config that reads it. Small enough to check ADR 006 D8-D13 by hand:

  pools    odour-left 101, odour-right 201; taste-left 301, taste-right 302;
           turn-left 401, turn-right 402, forward 403, backward 404, feed 405
  seeds    601, 602 (class SEEDCLS); 603 (superclass seed_super) — defaultSign/gaba sign both exercised
  fill     701 (shared 15: 10+5 with seed 601, both directions), 702 (shared 6 with 602) are the clear top 2
           when fill.neuronCount is 14 (12 seeds+pools, need 2); 703 and 704 (shared 5 each, a tie broken on
           ascending bodyId) and 708 (three edges of 4 synapses each — below minSynapses:5, so shared 0 when
           thresholded, 12 when not — the threshold-before-scoring case, D11) sit lower in the ranking;
           709 is admitted but never selected, and adds 5 real synapses into seed 601 that D12's "absolute"
           denominator must still count
  excluded 705 (olfactory, excludeClasses), 706 (vnc_motor, excludeSuperclasses), 707 (foo_sensory,
           excludeSuperclassSuffix) would otherwise be strong fill candidates
  other    710 (status Orphan, not admitted)

The probe's own direct 1-hop edges (101->401, 201->402, 301->405) make the D13 steering/feeding values
hand-computable at fidelity.steps=1 (see test_selection_class_seed.py's FidelityProbeTest).

Run from extract/:  python tests/make_class_seed_fixture.py
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "fixtures", "class-seed-synthetic.json")


def config():
    return {
        "formatVersion": 4,
        "kind": "forager",
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
            {"superclass": ["seed_super"]},
        ],
        "fill": {
            "neuronCount": 14,
            "excludeClasses": ["olfactory", "gustatory"],
            "excludeSuperclassSuffix": "_sensory",
            "excludeSuperclasses": ["vnc_motor", "cb_motor"],
        },
        "inputs": {
            "odour-left": {"class": "olfactory", "types": ["ORN_DM1"], "rootSide": "L"},
            "odour-right": {"class": "olfactory", "types": ["ORN_DM1"], "rootSide": "R"},
            "taste-left": {"class": "gustatory", "subclasses": ["labellar bristle"], "rootSide": "L"},
            "taste-right": {"class": "gustatory", "subclasses": ["labellar bristle"], "rootSide": "R"},
        },
        "sideMatch": {"odour": True, "taste": False},
        "outputs": {
            "turn-left": {"types": ["DNa01"], "somaSide": "L", "drive": "turnLeft"},
            "turn-right": {"types": ["DNa01"], "somaSide": "R", "drive": "turnRight"},
            "forward": {"types": ["DNp09"], "drive": "forward"},
            "backward": {"types": ["MDN"], "drive": "backward"},
            "feed": {"types": ["MN9"], "drive": "feed"},
        },
        "weightRule": "postFractionAbsolute",
        "modulators": [
            {"id": "hunger", "label": "Hunger", "range": [0, 1], "gain": [0.5, 1.5],
             "targets": ["odour-left", "odour-right"]},
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
        "fidelity": {"require": False, "steps": 8, "minContrastFraction": 0.1},
        "neuronCountRange": [1, 100],
    }


# bodyId, class, superclass, somaSide, status, type, rootSide, subclass, receptorType, consensus_nt
BODIES = [
    (101, "olfactory", "sensory", None, "Traced", "ORN_DM1", "L", None, None, "acetylcholine"),
    (201, "olfactory", "sensory", None, "Traced", "ORN_DM1", "R", None, None, "acetylcholine"),
    (301, "gustatory", "sensory", None, "Traced", "LgLG1", "L", "labellar bristle", None, "acetylcholine"),
    (302, "gustatory", "sensory", None, "Traced", "LgLG1", "R", "labellar bristle", None, "acetylcholine"),
    (401, "descending", "descending", "L", "Traced", "DNa01", None, None, None, "acetylcholine"),
    (402, "descending", "descending", "R", "Traced", "DNa01", None, None, None, "acetylcholine"),
    (403, "descending", "descending", None, "Traced", "DNp09", None, None, None, "acetylcholine"),
    (404, "descending", "descending", None, "Traced", "MDN", None, None, None, "acetylcholine"),
    (405, "motor", "motor", None, "Traced", "MN9", None, None, None, "acetylcholine"),
    (601, "SEEDCLS", "central", None, "Traced", "SC_A", None, None, None, "acetylcholine"),
    (602, "SEEDCLS", "central", None, "Traced", "SC_B", None, None, None, "gaba"),
    (603, "OTHERCLS", "seed_super", None, "Traced", "SS_A", None, None, None, "dopamine"),
    (701, "intrinsic", "central", None, "Traced", "INT_701", None, None, None, "acetylcholine"),
    (702, "intrinsic", "central", None, "Traced", "INT_702", None, None, None, "acetylcholine"),
    (703, "intrinsic", "central", None, "Traced", "INT_703", None, None, None, "glutamate"),
    (704, "intrinsic", "central", None, "Traced", "INT_704", None, None, None, "acetylcholine"),
    (705, "olfactory", "sensory", None, "Traced", "ORN_X", None, None, None, "acetylcholine"),
    (706, "vncmotorcls", "vnc_motor", None, "Traced", "MN_X", None, None, None, "acetylcholine"),
    (707, "weirdcls", "foo_sensory", None, "Traced", "WX", None, None, None, "acetylcholine"),
    (708, "intrinsic", "central", None, "Traced", "INT_708", None, None, None, "acetylcholine"),
    (709, "intrinsic", "central", None, "Traced", "INT_709", None, None, None, "acetylcholine"),
    (710, "intrinsic", "central", None, "Orphan", "INT_710", None, None, None, "acetylcholine"),
]

# (pre, post, synapses)
EDGES = [
    # probe's direct 1-hop edges (hand-computable at steps=1)
    (101, 401, 5), (201, 402, 5), (301, 405, 5),
    # output pools need at least one real inflow edge each (E-OUTPUT-UNREACHED)
    (601, 403, 5), (602, 404, 5),
    # fill scoring: shared(i) = sum of syn(i->seed) + syn(seed->i), at or above minSynapses (5)
    (701, 601, 10), (601, 701, 5),
    (702, 602, 6),
    (703, 603, 5),
    (704, 603, 5),
    # below minSynapses (5): dropped before scoring under the shipped threshold, counted if it were 1
    (708, 601, 4), (708, 602, 4), (602, 708, 4),
    # admitted, never selected as fill; still real inflow into seed 601 for D12's absolute denominator
    (709, 601, 5),
    # excluded-from-fill candidates, scored high if the exclusion rules did not apply
    (705, 601, 20), (706, 601, 20), (707, 601, 20),
    # from a non-traced (Orphan) body: ignored entirely
    (710, 601, 20),
]


def build():
    annotations = []
    transmitters = []
    for body, cls, superclass, soma_side, status, type_, root, subclass, receptor, nt in BODIES:
        annotations.append({
            "bodyId": body, "class": cls, "superclass": superclass, "somaSide": soma_side,
            "somaLocation": None, "status": status, "type": type_,
            "rootSide": root, "subclass": subclass, "receptorType": receptor,
        })
        transmitters.append({"body": body, "consensus_nt": nt})
    return {
        "synthetic": True,
        "note": "Hand-built class-seed fixture (Constitution III). Not connectome data. "
                "See make_class_seed_fixture.py.",
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
