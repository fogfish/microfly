"""ADR 002 selection rules (D1–D6) on small in-memory tables. No Feather files."""

import copy
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.config import load_config  # noqa: E402
from malecns_brain.errors import ExtractError  # noqa: E402
from malecns_brain.selection import admit, select_brain  # noqa: E402
from tests.make_fixture import ANNOTATION_ROWS, EDGE_ROWS, SOMA_LOCATIONS, TRANSMITTER_ROWS, CONFIG  # noqa: E402

REFERENCE = os.path.join(HERE, "..", "configs", "smallest-functional-brain.json")


def base_config(**changes):
    config = copy.deepcopy(CONFIG)
    config.update(changes)
    return config


def annotation(body, cls, superclass, side, status, type_):
    return {"bodyId": body, "class": cls, "superclass": superclass, "somaSide": side,
            "status": status, "type": type_}


def transmitter(body, nt, confidence):
    return {"body": body, "predicted_nt": nt, "predicted_nt_confidence": confidence}


def base_rows():
    annotations = [annotation(*row) for row in ANNOTATION_ROWS]
    transmitters = [transmitter(*row) for row in TRANSMITTER_ROWS]
    edges = [(pre, post, syn) for pre, post, syn in EDGE_ROWS]
    return annotations, transmitters, edges


def run(config=None, annotations=None, transmitters=None, edges=None):
    base_a, base_t, base_e = base_rows()
    config = config or base_config()
    bodies = admit(annotations if annotations is not None else base_a,
                   transmitters if transmitters is not None else base_t, config)
    return select_brain(config, bodies, columns(edges if edges is not None else base_e))


def columns(triples):
    """[(pre, post, synapses), ...] as the three parallel columns select_brain takes."""
    pre, post, syn = zip(*triples)
    return list(pre), list(post), list(syn)


class AdmissionTest(unittest.TestCase):
    def test_only_traced_bodies_are_admitted(self):
        annotations, transmitters, _ = base_rows()
        bodies = admit(annotations, transmitters, base_config())
        self.assertNotIn(102, bodies)   # ALPN, Orphan
        self.assertNotIn(202, bodies)   # DN L, Orphan
        self.assertIn(100, bodies)

    def test_transmitter_name_is_case_insensitive(self):
        annotations, transmitters, _ = base_rows()
        transmitters[0] = transmitter(100, "ACETYLCHOLINE", 0.9)
        bodies = admit(annotations, transmitters, base_config())
        self.assertEqual(bodies[100]["transmitter"], "acetylcholine")
        self.assertEqual(bodies[100]["sign"], 1)

    def test_confidence_exactly_at_threshold_is_admitted(self):
        annotations, transmitters, _ = base_rows()
        transmitters = [transmitter(305, "acetylcholine", 0.5) if t["body"] == 305 else t
                        for t in transmitters]
        self.assertIn(305, admit(annotations, transmitters, base_config()))

    def test_confidence_below_threshold_is_rejected(self):
        annotations, transmitters, _ = base_rows()
        self.assertNotIn(303, admit(annotations, transmitters, base_config()))   # 0.49

    def test_unmapped_transmitter_is_rejected(self):
        annotations, transmitters, _ = base_rows()
        self.assertNotIn(304, admit(annotations, transmitters, base_config()))   # histamine

    def test_duplicate_body_in_annotations_is_rejected(self):
        annotations, transmitters, _ = base_rows()
        annotations.append(dict(annotations[0]))
        with self.assertRaises(ExtractError) as caught:
            admit(annotations, transmitters, base_config())
        self.assertEqual(caught.exception.code, "E-DUP-BODY")

    def test_duplicate_body_in_transmitters_is_rejected(self):
        annotations, transmitters, _ = base_rows()
        transmitters.append(dict(transmitters[0]))
        with self.assertRaises(ExtractError) as caught:
            admit(annotations, transmitters, base_config())
        self.assertEqual(caught.exception.code, "E-DUP-BODY")


class SelectionTest(unittest.TestCase):
    def assertCode(self, code, **changes):
        with self.assertRaises(ExtractError) as caught:
            run(**changes)
        self.assertEqual(caught.exception.code, code)

    def test_base_scenario_selects_the_hand_checked_brain(self):
        brain = run()
        self.assertEqual([n["bodyId"] for n in brain["neurons"]], [100, 200, 201, 300, 302])
        self.assertEqual([n["role"] for n in brain["neurons"]],
                         ["sensory", "left", "right", "interneuron", "interneuron"])
        self.assertEqual(brain["edgeCount"], 4)

    def test_sensory_is_the_alpn_with_largest_admitted_output(self):
        # 101 has one synapse to 300; 100 has 11 admitted outgoing synapses.
        self.assertEqual(run()["neurons"][0]["bodyId"], 100)

    def test_sensory_ties_break_on_smallest_body_id(self):
        annotations, transmitters, edges = base_rows()
        # 100 has 11 admitted outgoing synapses (5+3+2+1); give 101 the same total.
        edges = [(p, q, 11 if (p, q) == (101, 300) else s) for p, q, s in edges]
        brain = run(annotations=annotations, transmitters=transmitters, edges=edges)
        self.assertEqual(brain["neurons"][0]["bodyId"], 100)

    def test_readout_takes_the_largest_two_hop_input(self):
        annotations, transmitters, edges = base_rows()
        annotations.append(annotation(203, None, "descending_neuron", "L", "Traced", "synthetic-dn-l2"))
        transmitters.append(transmitter(203, "acetylcholine", 0.9))
        edges.append((300, 203, 9))   # 300 is a partner of the sensory neuron
        brain = run(annotations=annotations, transmitters=transmitters, edges=edges)
        self.assertEqual(brain["neurons"][1]["bodyId"], 203)
        self.assertEqual(brain["readoutInput"]["left"], 9)

    def test_reserved_slot_keeps_a_left_reacher_ranked_below_the_cut(self):
        # maxInterneurons 2: by score alone, 300 (4) and 301 (2) win; 302 (2, LEFT) ties 301 on
        # score and loses on bodyId only if counted. The reserved LEFT slot must still take 302.
        config = base_config(maxInterneurons=2)
        brain = run(config=config)
        self.assertEqual([n["bodyId"] for n in brain["neurons"][3:]], [300, 302])
        self.assertEqual(brain["reserved"], {"left": 302, "right": 300})

    def test_too_few_interneurons(self):
        self.assertCode("E-TOO-FEW", config=base_config(minInterneurons=3))

    def test_no_path_to_left(self):
        annotations, transmitters, edges = base_rows()
        edges = [(p, q, s) for p, q, s in edges if q != 200]
        self.assertCode("E-NO-PATH", annotations=annotations, transmitters=transmitters, edges=edges)

    def test_no_admitted_alpn(self):
        annotations, transmitters, edges = base_rows()
        annotations = [dict(a, **({"class": "olfactory"} if a["class"] == "ALPN" else {})) for a in annotations]
        self.assertCode("E-SENSORY-NONE", annotations=annotations, transmitters=transmitters, edges=edges)

    def test_no_readout_on_one_side(self):
        annotations, transmitters, edges = base_rows()
        annotations = [a for a in annotations if a["bodyId"] != 201]
        self.assertCode("E-READOUT-NONE", annotations=annotations, transmitters=transmitters, edges=edges)

    def test_unknown_sign_on_a_selected_body_is_rejected(self):
        annotations, transmitters, edges = base_rows()
        bodies = admit(annotations, transmitters, base_config())
        bodies[300] = dict(bodies[300], sign=None)
        with self.assertRaises(ExtractError) as caught:
            select_brain(base_config(), bodies, columns(edges))
        self.assertEqual(caught.exception.code, "E-SIGN")

    def test_no_edge_leaves_the_sensory_neuron(self):
        # Without sensory out-edges, D3 finds no candidate, so E-NO-PATH fires before the
        # induced-subgraph check (E-EMPTY-EDGES is a backstop for the same condition).
        annotations, transmitters, edges = base_rows()
        edges = [(p, q, s) for p, q, s in edges if p != 100]
        self.assertCode("E-NO-PATH", annotations=annotations, transmitters=transmitters, edges=edges)

    def test_expected_neuron_count_mismatch(self):
        self.assertCode("E-NODE-COUNT", config=base_config(expectedNeuronCount=6))

    def test_duplicate_edge_is_rejected(self):
        _, _, edges = base_rows()
        self.assertCode("E-DUP-EDGE", edges=edges + [(100, 300, 1)])

    def test_synapse_count_above_uint16_is_rejected(self):
        annotations, transmitters, edges = base_rows()
        edges = [(p, q, 65536 if (p, q) == (100, 300) else s) for p, q, s in edges]
        self.assertCode("E-OVERFLOW", annotations=annotations, transmitters=transmitters, edges=edges)

    def test_weight_rule_is_sign_times_capped_count_over_cap(self):
        brain = run()
        weights = dict(zip(zip(brain["pre"], brain["post"]), brain["weights"]))
        self.assertAlmostEqual(weights[(0, 3)], 1.0)                 # 5 / 5, sign +1
        self.assertAlmostEqual(weights[(0, 4)], 2 / 5)               # 2 / 5, sign +1
        self.assertAlmostEqual(weights[(4, 1)], -3 / 5)              # 302 is glutamate, sign -1

    def test_cap_is_applied_to_large_counts(self):
        annotations, transmitters, edges = base_rows()
        edges = [(p, q, 40 if (p, q) == (100, 300) else s) for p, q, s in edges]
        brain = run(annotations=annotations, transmitters=transmitters, edges=edges)
        weights = dict(zip(zip(brain["pre"], brain["post"]), brain["weights"]))
        self.assertAlmostEqual(weights[(0, 3)], 1.0)                 # min(40, 5) / 5
        self.assertEqual(dict(zip(zip(brain["pre"], brain["post"]), brain["synapses"]))[(0, 3)], 40)


class SomaTest(unittest.TestCase):
    def test_three_integer_location_is_carried_to_the_neuron(self):
        neurons = run_with_soma()["neurons"]
        self.assertEqual(neurons[0]["soma"], SOMA_LOCATIONS[100])
        self.assertEqual(neurons[1]["soma"], SOMA_LOCATIONS[200])

    def test_missing_location_gives_none_on_the_neuron(self):
        neurons = run_with_soma()["neurons"]
        self.assertIsNone(neurons[4]["soma"])   # body 302 has no position in the fixture

    def test_malformed_locations_become_none(self):
        for location in (None, [], [1, 2], [1.0, 2.0, 3.0], [True, 2, 3], "1,2,3"):
            with self.subTest(location=location):
                annotations, transmitters, _ = base_rows()
                for row in annotations:
                    row["somaLocation"] = location if row["bodyId"] == 201 else None
                bodies = admit(annotations, transmitters, base_config())
                self.assertIsNone(bodies[201]["soma"])

    def test_superclass_is_carried_to_the_neuron(self):
        neurons = run_with_soma()["neurons"]
        self.assertEqual(neurons[0]["superclass"], "ascending_neuron")
        self.assertEqual(neurons[1]["superclass"], "descending_neuron")
        self.assertEqual(neurons[3]["superclass"], "intrinsic")

    def test_positions_do_not_change_admission_or_edges(self):
        plain = run()
        positioned = run_with_soma()
        self.assertEqual([n["bodyId"] for n in plain["neurons"]], [n["bodyId"] for n in positioned["neurons"]])
        self.assertEqual(plain["edgeCount"], positioned["edgeCount"])
        self.assertEqual(plain["targets"].tobytes(), positioned["targets"].tobytes())


def run_with_soma():
    annotations, transmitters, edges = base_rows()
    for row, source in zip(annotations, ANNOTATION_ROWS):
        row["somaLocation"] = SOMA_LOCATIONS[source[0]]
    return run(annotations=annotations, transmitters=transmitters, edges=edges)


if __name__ == "__main__":
    unittest.main()
