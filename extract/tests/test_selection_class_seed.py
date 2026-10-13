"""Class-seeded selection (ADR 006 D8-D13) on the labelled synthetic fixture
(tests/fixtures/class-seed-synthetic.json). No Feather files. The fixture is SYNTHETIC (Constitution III); its
numbers are checked against the rules, not against connectome data. See make_class_seed_fixture.py for the
hand-derived expectations."""

import copy
import json
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.admission import admit_all_traced  # noqa: E402
from malecns_brain.selection_class_seed import (  # noqa: E402
    apply_threshold, fill_candidates, resolve_pools, seed_bodies, select_class_seed,
)

FIXTURE = os.path.join(HERE, "fixtures", "class-seed-synthetic.json")
POOL_BODIES = {101, 201, 301, 302, 401, 402, 403, 404, 405}
CENTRAL_SEEDS = {601, 602, 603}


def load():
    with open(FIXTURE, encoding="utf-8") as handle:
        return json.load(handle)


def admitted(data, config=None):
    config = config or data["config"]
    return admit_all_traced(data["annotations"], data["transmitters"], config)


def edge_table(data):
    e = data["edges"]
    return (np.array(e["pre"], dtype=np.int64), np.array(e["post"], dtype=np.int64),
            np.array(e["synapses"], dtype=np.int64))


def run(data, config=None):
    config = config or data["config"]
    bodies = admitted(data, config)
    return select_class_seed(config, bodies, edge_table(data))


class AdmitAllTracedTest(unittest.TestCase):
    def setUp(self):
        self.data = load()
        self.bodies = admitted(self.data)

    def test_every_traced_body_is_admitted_regardless_of_transmitter(self):
        self.assertNotIn(710, self.bodies)  # Orphan, not Traced
        for body in (601, 602, 603, 701, 705, 706, 707, 708, 709):
            self.assertIn(body, self.bodies)

    def test_sign_from_transmitter_sign_and_default_sign(self):
        self.assertEqual(self.bodies[602]["sign"], -1)  # gaba
        self.assertEqual(self.bodies[703]["sign"], -1)  # glutamate
        self.assertEqual(self.bodies[601]["sign"], 1)  # acetylcholine -> defaultSign
        self.assertEqual(self.bodies[603]["sign"], 1)  # dopamine, not in transmitterSign -> defaultSign
        self.assertEqual(self.bodies[603]["transmitter"], "dopamine")


class SeedBodiesTest(unittest.TestCase):
    def setUp(self):
        self.data = load()
        self.bodies = admitted(self.data)

    def test_seed_classes_are_complete_with_no_sampling(self):
        seeds = seed_bodies(self.data["config"], self.bodies)
        self.assertEqual(set(seeds), CENTRAL_SEEDS)
        self.assertEqual(seeds[601], "seed:SEEDCLS")
        self.assertEqual(seeds[603], "seed:seed_super")

    def test_empty_filter_raises_e_seed_empty(self):
        config = copy.deepcopy(self.data["config"])
        config["seeds"][0]["class"] = ["NOPE"]
        with self.assertRaises(Exception) as ctx:
            seed_bodies(config, self.bodies)
        self.assertEqual(ctx.exception.code, "E-SEED-EMPTY")


class FillCandidatesTest(unittest.TestCase):
    def setUp(self):
        self.data = load()
        self.bodies = admitted(self.data)
        self.seed_ids = set(seed_bodies(self.data["config"], self.bodies)) | POOL_BODIES

    def _fill(self, min_synapses, need):
        config = copy.deepcopy(self.data["config"])
        config["fill"]["neuronCount"] = len(self.seed_ids) + need
        edges = apply_threshold(edge_table(self.data), min_synapses)
        return fill_candidates(config, self.bodies, edges, self.seed_ids)

    def test_top_two_by_shared_weight(self):
        # 701: shared 10+5=15 (both directions with seed 601); 702: shared 6 with seed 602.
        self.assertEqual(self._fill(5, 2), {701, 702})

    def test_ties_break_on_the_smallest_body_id(self):
        # 703 and 704 both share exactly 5 synapses with seed 603; 703 < 704 wins the third slot.
        self.assertEqual(self._fill(5, 3), {701, 702, 703})

    def test_threshold_is_applied_before_scoring(self):
        # 708's three edges (4 synapses each) are all below minSynapses=5: shared(708) is 0 when thresholded,
        # so 702 (shared 6) wins the second slot. At minSynapses=1 the same edges count (shared(708)=12),
        # displacing 702.
        self.assertEqual(self._fill(5, 2), {701, 702})
        self.assertEqual(self._fill(1, 2), {701, 708})

    def test_exclusion_rules_remove_otherwise_strong_candidates(self):
        # 705 (olfactory), 706 (vnc_motor) and 707 (foo_sensory) each have 20 synapses with seed 601 — stronger
        # than every real candidate — but are excluded by fill.excludeClasses/excludeSuperclasses/
        # excludeSuperclassSuffix.
        fill = self._fill(5, 5)
        self.assertFalse(fill & {705, 706, 707})

    def test_seed_overflow(self):
        config = copy.deepcopy(self.data["config"])
        config["fill"]["neuronCount"] = len(self.seed_ids) - 2
        edges = apply_threshold(edge_table(self.data), 5)
        with self.assertRaises(Exception) as ctx:
            fill_candidates(config, self.bodies, edges, self.seed_ids)
        self.assertEqual(ctx.exception.code, "E-SEED-OVERFLOW")


class ResolvePoolsTest(unittest.TestCase):
    def test_pools_match_class_type_and_root_side(self):
        data = load()
        bodies = admitted(data)
        inputs, outputs = resolve_pools(data["config"], bodies)
        self.assertEqual(inputs["odour-left"], [101])
        self.assertEqual(inputs["odour-right"], [201])
        self.assertEqual(inputs["taste-left"], [301])
        self.assertEqual(outputs["turn-left"], [401])
        self.assertEqual(outputs["feed"], [405])


class SelectClassSeedTest(unittest.TestCase):
    def setUp(self):
        self.data = load()
        self.brain = run(self.data)
        self.neurons = self.brain["neurons"]
        self.body_of = [n["bodyId"] for n in self.neurons]

    def test_neuron_order_is_inputs_outputs_then_interneurons_by_body_id(self):
        self.assertEqual(self.body_of[:9], [101, 201, 301, 302, 401, 402, 403, 404, 405])
        interneurons = self.body_of[9:]
        self.assertEqual(interneurons, sorted(interneurons))
        self.assertEqual(set(interneurons), {601, 602, 603, 701, 702})

    def test_pool_neurons_have_no_origin(self):
        for neuron in self.neurons[:9]:
            self.assertIsNone(neuron["origin"])

    def test_central_seeds_and_fill_are_tagged(self):
        origin_of = {n["bodyId"]: n["origin"] for n in self.neurons}
        self.assertEqual(origin_of[601], "seed:SEEDCLS")
        self.assertEqual(origin_of[603], "seed:seed_super")
        self.assertEqual(origin_of[701], "fill")
        self.assertEqual(origin_of[702], "fill")

    def test_neuron_count_matches_fill_neuron_count(self):
        self.assertEqual(len(self.neurons), self.data["config"]["fill"]["neuronCount"])
        self.assertEqual(self.brain["seedCount"], 12)
        self.assertEqual(self.brain["fillCount"], 2)

    def test_output_outgoing_edges_are_dropped(self):
        output_bodies = {401, 402, 403, 404, 405}
        sources = {self.body_of[i] for i in range(len(self.neurons))
                   if self.brain["offsets"][i + 1] > self.brain["offsets"][i]}
        self.assertFalse(sources & output_bodies)

    def test_weights_are_sign_consistent_and_inflow_is_bounded(self):
        inflow = np.zeros(len(self.neurons))
        np.add.at(inflow, self.brain["targets"].astype(np.int64), np.abs(self.brain["weights"]).astype(np.float64))
        self.assertTrue(np.all(inflow <= 1.0 + 1e-6))

    def test_absolute_denominator_counts_real_inflow_outside_the_brain(self):
        # Body 601's real admitted inflow at >=5 synapses is 701 (10) + 709 (5) + 705/706/707 (20 each) = 75,
        # even though 705-707 and 709 are not in the selected brain (D12's "absolute" denominator).
        index_of = {n["bodyId"]: n["index"] for n in self.neurons}
        offsets, targets, weights = self.brain["offsets"], self.brain["targets"], self.brain["weights"]
        idx701 = index_of[701]
        weight_701_601 = None
        for k in range(offsets[idx701], offsets[idx701 + 1]):
            if int(targets[k]) == index_of[601]:
                weight_701_601 = float(weights[k])
        self.assertAlmostEqual(weight_701_601, 10 / 75, places=5)

    def test_selection_is_deterministic(self):
        again = run(self.data)
        self.assertEqual(again["neurons"], self.neurons)
        for name in ("offsets", "targets", "weights", "synapses"):
            self.assertEqual(again[name].tobytes(), self.brain[name].tobytes())


class FidelityProbeTest(unittest.TestCase):
    """Hand-computable at fidelity.steps=1: the probe's own direct 1-hop edges (101->401, 201->402, 301->405)
    make r = A x0 exactly, with weight 1.0 on each (single real admitted inflow edge), see
    make_class_seed_fixture.py's module docstring for the derivation."""

    def test_steering_and_feeding_values_match_the_hand_derivation(self):
        data = load()
        config = copy.deepcopy(data["config"])
        config["fidelity"] = {"require": False, "steps": 1, "minContrastFraction": 0.1}
        brain = run(data, config)
        fidelity = brain["fidelity"]
        self.assertAlmostEqual(fidelity["steering"]["brainContrast"], 2.0, places=5)
        self.assertAlmostEqual(fidelity["steering"]["wholeGraphContrast"], 2.0, places=5)
        self.assertTrue(fidelity["steering"]["pass"])
        self.assertAlmostEqual(fidelity["feeding"]["brainValue"], 0.5, places=5)
        self.assertAlmostEqual(fidelity["feeding"]["wholeGraphValue"], 0.5, places=5)
        self.assertTrue(fidelity["feeding"]["pass"])

    def test_require_true_raises_e_fidelity_naming_both_values_when_unreachable(self):
        data = load()
        config = copy.deepcopy(data["config"])
        config["fidelity"] = {"require": True, "steps": 1, "minContrastFraction": 10.0}
        with self.assertRaises(Exception) as ctx:
            run(data, config)
        self.assertEqual(ctx.exception.code, "E-FIDELITY")
        message = str(ctx.exception)
        self.assertIn("2", message)

    def test_require_false_still_computes_and_stores_a_failing_check(self):
        data = load()
        config = copy.deepcopy(data["config"])
        config["fidelity"] = {"require": False, "steps": 1, "minContrastFraction": 10.0}
        brain = run(data, config)
        self.assertFalse(brain["fidelity"]["steering"]["pass"])


if __name__ == "__main__":
    unittest.main()
