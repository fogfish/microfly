"""Forager selection (ADR 003 D1–D4) on the labelled synthetic fixture (tests/fixtures/forager-synthetic.json).
No Feather files. The fixture is SYNTHETIC (Constitution III); its numbers are checked against the rules, not against
connectome data."""

import copy
import json
import math
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.admission import admit_forager  # noqa: E402
from malecns_brain.selection_forager import resolve_pools, select_forager, top_by_score  # noqa: E402

FIXTURE = os.path.join(HERE, "fixtures", "forager-synthetic.json")
OUTPUT_TYPES = {"DNa01", "DNa02", "DNp09", "MDN", "MN9"}
OUTPUT_BODIES = {401, 402, 403, 404, 405, 406, 407}
SENSORY_CLASSES = {"olfactory", "gustatory", "visual"}


def load():
    with open(FIXTURE, encoding="utf-8") as handle:
        return json.load(handle)


def admitted(data, config=None):
    config = config or data["config"]
    pool_types = {t for spec in config["outputs"].values() for t in spec["types"]}
    bodies = admit_forager(data["annotations"], data["transmitters"], config, pool_types)
    return bodies


def edge_table(data):
    e = data["edges"]
    return np.array(e["pre"], dtype=np.int64), np.array(e["post"], dtype=np.int64), np.array(e["synapses"], dtype=np.int64)


def run(data, config=None):
    config = config or data["config"]
    bodies = admitted(data, config)
    return select_forager(config, bodies, edge_table(data))


class PoolResolutionTest(unittest.TestCase):
    def setUp(self):
        self.data = load()
        self.bodies = admitted(self.data)

    def test_pools_follow_class_subclass_prefix_and_root_side(self):
        config = copy.deepcopy(self.data["config"])
        config["sideMatch"] = {"odour": False, "taste": False}
        inputs, _ = resolve_pools(config, self.bodies)
        self.assertEqual(inputs["odour-left"], [101, 102, 103])
        self.assertEqual(inputs["odour-right"], [201, 202])
        self.assertEqual(inputs["taste-left"], [301])
        self.assertEqual(inputs["taste-right"], [302])

    def test_side_matching_keeps_the_first_min_by_ascending_body_id_per_type(self):
        inputs, _ = resolve_pools(self.data["config"], self.bodies)
        # DM2: left 102, 103 and right 202, so the first min(2, 1) = 1 left body is kept (102).
        self.assertEqual(inputs["odour-left"], [101, 102])
        self.assertEqual(inputs["odour-right"], [201, 202])

    def test_side_match_false_keeps_all_bodies(self):
        config = copy.deepcopy(self.data["config"])
        config["sideMatch"] = {"odour": False, "taste": False}
        inputs, _ = resolve_pools(config, self.bodies)
        self.assertEqual(len(inputs["odour-left"]), 3)

    def test_output_pools_filter_by_type_and_soma_side(self):
        _, outputs = resolve_pools(self.data["config"], self.bodies)
        self.assertEqual(outputs["turn-left"], [401, 403])
        self.assertEqual(outputs["turn-right"], [402, 404])
        self.assertEqual(outputs["forward"], [405])
        self.assertEqual(outputs["feed"], [407])

    def test_sign_zero_output_is_admitted_with_no_transmitter_certainty(self):
        self.assertEqual(self.bodies[407]["sign"], 0)
        self.assertEqual(self.bodies[407]["transmitter"], "unclear")

    def test_non_traced_bodies_are_not_admitted(self):
        self.assertNotIn(507, self.bodies)
        self.assertEqual(self.bodies[101]["rootSide"], "L")
        self.assertEqual(self.bodies[301]["subclass"], "labellar bristle")


class TopByScoreTest(unittest.TestCase):
    def test_ties_break_on_the_smallest_body_id(self):
        scores = {900: 0.5, 17: 0.5, 300: 0.5, 42: 0.9}
        self.assertEqual(top_by_score(scores, 3), [42, 17, 300])

    def test_zero_scores_are_not_candidates(self):
        self.assertEqual(top_by_score({1: 0.0, 2: 0.2}, 5), [2])


class SelectionTest(unittest.TestCase):
    def setUp(self):
        self.data = load()
        self.brain = run(self.data)
        self.neurons = self.brain["neurons"]
        self.body_of = [n["bodyId"] for n in self.neurons]

    def test_neuron_order_is_inputs_outputs_then_interneurons(self):
        self.assertEqual(self.body_of[:6], [101, 102, 201, 202, 301, 302])
        self.assertEqual(self.body_of[6:13], [401, 403, 402, 404, 405, 406, 407])
        interneurons = self.body_of[13:]
        self.assertEqual(interneurons, sorted(interneurons))
        self.assertTrue(all(n["role"] == "interneuron" for n in self.neurons[13:]))

    def test_interneurons_are_chosen_from_the_flow_and_are_intrinsic(self):
        interneurons = set(self.body_of[13:])
        self.assertTrue(interneurons)
        self.assertTrue(interneurons <= {501, 502, 503, 504})

    def test_sensory_and_unreached_bodies_are_excluded(self):
        for body in (103, 104, 303, 505, 506, 507):
            self.assertNotIn(body, self.body_of)
        for neuron in self.neurons:
            if neuron["role"] == "interneuron":
                self.assertNotIn(neuron["class"], SENSORY_CLASSES)

    def test_output_outgoing_edges_are_dropped(self):
        sources = {self.body_of[i] for i in range(len(self.neurons))
                   if self.brain["offsets"][i + 1] > self.brain["offsets"][i]}
        self.assertFalse(sources & OUTPUT_BODIES)

    def test_every_output_pool_receives_an_edge(self):
        index_of = {body: i for i, body in enumerate(self.body_of)}
        targets = set(int(t) for t in self.brain["targets"])
        for body in OUTPUT_BODIES:
            self.assertIn(index_of[body], targets)

    def test_sign_zero_output_has_no_outgoing_edge(self):
        index = self.body_of.index(407)
        self.assertEqual(self.brain["offsets"][index], self.brain["offsets"][index + 1])

    def test_weights_are_post_fraction_and_inflow_sums_are_at_most_one(self):
        inflow = np.zeros(len(self.neurons))
        np.add.at(inflow, self.brain["targets"].astype(np.int64), np.abs(self.brain["weights"]).astype(np.float64))
        self.assertTrue(np.all(inflow <= 1.0 + 1e-6))
        offsets, weights = self.brain["offsets"], self.brain["weights"]
        for pre in range(len(self.neurons)):
            for k in range(offsets[pre], offsets[pre + 1]):
                sign = self.neurons[pre]["sign"]
                self.assertEqual(math.copysign(1, float(weights[k])), sign)

    def test_selection_is_deterministic(self):
        again = run(self.data)
        self.assertEqual(again["neurons"], self.neurons)
        for name in ("offsets", "targets", "weights", "synapses"):
            self.assertEqual(again[name].tobytes(), self.brain[name].tobytes())


if __name__ == "__main__":
    unittest.main()
