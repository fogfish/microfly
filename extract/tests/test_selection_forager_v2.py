"""Forager-v2 selection (ADR 006 D8–D13) on the labelled synthetic fixture
(tests/fixtures/forager-15k-synthetic.json). No Feather files. The fixture is SYNTHETIC (Constitution III); its
numbers are checked against the rules, not against connectome data."""

import copy
import json
import math
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.admission import admit_forager_v2  # noqa: E402
from malecns_brain.selection_forager_v2 import _excluded, region_of, resolve_pools, select_forager_v2  # noqa: E402

FIXTURE = os.path.join(HERE, "fixtures", "forager-15k-synthetic.json")
OUTPUT_BODIES = {3001, 3002, 3003, 3004, 3005, 3006}
INTERNEURON_CANDIDATE_BODIES = {4001, 4003, 4004, 4005, 4006, 4007}


def load():
    with open(FIXTURE, encoding="utf-8") as handle:
        return json.load(handle)


def admitted(data, config=None):
    config = config or data["config"]
    pool_types = {t for spec in config["outputs"].values() for t in spec["types"]}
    return admit_forager_v2(data["annotations"], data["transmitters"], config, pool_types)


def edge_table(data):
    e = data["edges"]
    return (np.array(e["pre"], dtype=np.int64), np.array(e["post"], dtype=np.int64),
            np.array(e["synapses"], dtype=np.int64))


def run(data, config=None):
    config = config or data["config"]
    bodies = admitted(data, config)
    return select_forager_v2(config, bodies, edge_table(data))


class PoolResolutionTest(unittest.TestCase):
    def setUp(self):
        self.data = load()
        self.bodies = admitted(self.data)

    def test_every_one_of_the_six_senses_resolves_its_pool(self):
        inputs, _ = resolve_pools(self.data["config"], self.bodies)
        self.assertEqual(inputs["odour-food-left"], [1001])
        self.assertEqual(inputs["odour-food-right"], [2001])
        self.assertEqual(inputs["odour-danger-left"], [1002])
        self.assertEqual(inputs["odour-danger-right"], [2002])
        self.assertEqual(inputs["heat-left"], [1003])
        self.assertEqual(inputs["heat-right"], [2003])
        self.assertEqual(inputs["taste-mouth-left"], [1004])
        self.assertEqual(inputs["taste-mouth-right"], [2004])
        self.assertEqual(inputs["taste-leg-left"], [1005])
        self.assertEqual(inputs["taste-leg-right"], [2005])
        self.assertEqual(inputs["touch-left"], [1006])
        self.assertEqual(inputs["touch-right"], [2006])

    def test_output_pools_filter_by_type_and_soma_side(self):
        _, outputs = resolve_pools(self.data["config"], self.bodies)
        self.assertEqual(outputs["turn-left"], [3001])
        self.assertEqual(outputs["turn-right"], [3002])
        self.assertEqual(outputs["escape"], [3006])

    def test_unmatched_pathways_keep_each_side_independently(self):
        # taste-mouth/taste-leg are sideMatch: false (D8) — no truncation even though each side has one body here.
        inputs, _ = resolve_pools(self.data["config"], self.bodies)
        self.assertEqual(inputs["taste-mouth-left"], [1004])
        self.assertEqual(inputs["taste-leg-right"], [2005])

    def test_sign_zero_output_is_admitted_with_no_resolved_transmitter(self):
        self.assertEqual(self.bodies[3006]["sign"], 0)
        self.assertEqual(self.bodies[3006]["transmitterSource"], "predicted_nt")

    def test_non_traced_bodies_are_not_admitted(self):
        self.assertNotIn(5001, self.bodies)

    def test_transmitter_source_fallback_order(self):
        # 2001 has no predicted_nt, only ground_truth; 1002 has only consensus_nt.
        self.assertEqual(self.bodies[2001]["transmitterSource"], "ground_truth")
        self.assertEqual(self.bodies[1002]["transmitterSource"], "consensus_nt")
        self.assertEqual(self.bodies[1001]["transmitterSource"], "predicted_nt")

    def test_pool_overlap_is_detected(self):
        config = copy.deepcopy(self.data["config"])
        # Make taste-mouth-left also match body 1005 (already taste-leg-left) by widening its subclass list.
        config["inputs"]["taste-mouth-left"]["subclasses"].append("leg bristle")
        from malecns_brain.errors import ExtractError
        with self.assertRaises(ExtractError) as caught:
            resolve_pools(config, self.bodies)
        self.assertEqual(caught.exception.code, "E-POOL-OVERLAP")


class RegionTaxonomyTest(unittest.TestCase):
    def test_input_and_output_roles_win_first(self):
        self.assertEqual(region_of("input", {"class": "ALLN"}), "input")
        self.assertEqual(region_of("output", {"class": "ALLN"}), "output")

    def test_al_classes(self):
        for cls in ("ALLN", "ALPN", "ALIN", "ALON"):
            self.assertEqual(region_of("interneuron", {"class": cls, "superclass": "x"}), "al")

    def test_vnc_superclasses(self):
        for superclass in ("vnc_intrinsic", "vnc_motor", "vnc_efferent", "ascending_neuron"):
            self.assertEqual(region_of("interneuron", {"class": "x", "superclass": superclass}), "vnc")

    def test_dn_superclass(self):
        self.assertEqual(region_of("interneuron", {"class": "x", "superclass": "descending_neuron"}), "dn")

    def test_everything_else_is_central(self):
        self.assertEqual(region_of("interneuron", {"class": "x", "superclass": "cb_intrinsic"}), "central")


class ExclusionTest(unittest.TestCase):
    def test_excluded_class(self):
        config = {"excludeInterneuronClasses": ["olfactory"], "excludeInterneuronSuperclassSuffix": "_sensory"}
        self.assertTrue(_excluded({"class": "olfactory", "superclass": "x"}, config))
        self.assertFalse(_excluded({"class": "gustatory", "superclass": "x"}, config))

    def test_excluded_superclass_suffix(self):
        config = {"excludeInterneuronClasses": [], "excludeInterneuronSuperclassSuffix": "_sensory"}
        self.assertTrue(_excluded({"class": "x", "superclass": "cb_sensory"}, config))
        self.assertFalse(_excluded({"class": "x", "superclass": "cb_intrinsic"}, config))


class SelectionTest(unittest.TestCase):
    def setUp(self):
        self.data = load()
        self.brain = run(self.data)
        self.neurons = self.brain["neurons"]
        self.body_of = [n["bodyId"] for n in self.neurons]

    def test_neuron_order_is_inputs_outputs_then_interneurons(self):
        # Inputs follow channel declaration order (odour-food-left/right, odour-danger-left/right, ...), not a
        # global ascending-bodyId sort.
        self.assertEqual(self.body_of[:12], [1001, 2001, 1002, 2002, 1003, 2003, 1004, 2004, 1005, 2005, 1006, 2006])
        self.assertTrue(all(n["role"] == "input" for n in self.neurons[:12]))
        self.assertTrue(all(n["role"] == "output" for n in self.neurons[12:18]))
        interneurons = self.body_of[18:]
        self.assertEqual(interneurons, sorted(interneurons))
        self.assertTrue(all(n["role"] == "interneuron" for n in self.neurons[18:]))

    def test_anchor_class_is_included_regardless_of_score(self):
        self.assertIn(4001, self.body_of)
        anchor = next(n for n in self.neurons if n["bodyId"] == 4001)
        self.assertEqual(anchor["group"], "al")

    def test_excluded_class_candidate_is_removed_despite_flow(self):
        self.assertNotIn(4007, self.body_of)

    def test_d11_score_is_sign_aware_bug_001(self):
        # 4004 is GABA (sign -1) and uniformly connected to every pathway and every output, exactly like
        # 4003/4005/4006 (acetylcholine, sign +1) -- before the BUG-001 fix, D11's score was flow-magnitude-only
        # and 4004 tied every pair, winning a budget slot on the ascending-bodyId tie-break. The signed score
        # (score_{p,o}(i) = 0 when the signed backward flow to the group is not positive) now excludes it from
        # every pair, so it never enters `chosen` at all; 4006 (previously squeezed out by the tie only because
        # it shared 4004's score) is admitted instead.
        self.assertNotIn(4004, self.body_of)
        self.assertIn(4006, self.body_of)

    def test_every_output_pool_receives_an_edge(self):
        index_of = {body: i for i, body in enumerate(self.body_of)}
        targets = set(int(t) for t in self.brain["targets"])
        for body in OUTPUT_BODIES:
            self.assertIn(index_of[body], targets)

    def test_output_outgoing_edges_are_dropped(self):
        sources = {self.body_of[i] for i in range(len(self.neurons))
                   if self.brain["offsets"][i + 1] > self.brain["offsets"][i]}
        self.assertFalse(sources & OUTPUT_BODIES)

    def test_sign_zero_output_has_no_outgoing_edge(self):
        index = self.body_of.index(3006)
        self.assertEqual(self.brain["offsets"][index], self.brain["offsets"][index + 1])

    def test_every_neuron_has_a_region_group(self):
        for n in self.neurons:
            self.assertIn(n["group"], ("input", "output", "al", "vnc", "dn", "central"))

    def test_synapse_count_weights_are_sign_times_synapses_unnormalised(self):
        offsets, weights, synapses = self.brain["offsets"], self.brain["weights"], self.brain["synapses"]
        for pre in range(len(self.neurons)):
            sign = self.neurons[pre]["sign"]
            for k in range(offsets[pre], offsets[pre + 1]):
                expected = sign * int(synapses[k])
                self.assertAlmostEqual(float(weights[k]), expected, places=4)

    def test_selection_is_deterministic(self):
        again = run(self.data)
        self.assertEqual(again["neurons"], self.neurons)
        for name in ("offsets", "targets", "weights", "synapses"):
            self.assertEqual(again[name].tobytes(), self.brain[name].tobytes())


class WeightRuleTest(unittest.TestCase):
    def setUp(self):
        self.data = load()

    def test_post_fraction_absolute_normalises_and_stays_at_most_one(self):
        config = copy.deepcopy(self.data["config"])
        config["weightRule"] = "postFractionAbsolute"
        brain = run(self.data, config)
        inflow = np.zeros(len(brain["neurons"]))
        np.add.at(inflow, brain["targets"].astype(np.int64), np.abs(brain["weights"]).astype(np.float64))
        self.assertTrue(np.all(inflow <= 1.0 + 1e-6))

    def test_min_synapses_drops_weak_edges(self):
        # The anchor's own edges are syn=1; every pair-grid mesh edge is syn=2, so minSynapses=2 drops only the
        # anchor's three edges, leaving every pair still reachable.
        config = copy.deepcopy(self.data["config"])
        config["minSynapses"] = 2
        brain = run(self.data, config)
        self.assertTrue(np.all(brain["synapses"] >= 2))
        full = run(self.data)
        self.assertEqual(brain["edgeCount"], full["edgeCount"] - 3)


if __name__ == "__main__":
    unittest.main()
