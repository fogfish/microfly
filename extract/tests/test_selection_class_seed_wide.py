"""Wide-I/O class-seed selection (ADR 007 D15-D20) on the labelled synthetic fixture
(tests/fixtures/forager-wide-synthetic.json). No Feather files. The fixture is SYNTHETIC (Constitution III); its
numbers are checked against the rules, not against connectome data. See make_forager_wide_fixture.py's module
docstring for the hand-derived fidelity values.

Hand derivation (steps=1, "absolute" denominator = every real admitted inflow edge at >=minSynapses into a
body): 601 receives 101->601 (10), 103->601 (5), 501->601 (5), denom 20; weights 0.5, 0.25, 0.25. 602 receives
the symmetric 10/5/5 from 201/203/502, denom 20, same weights. Each pool has one body per side, so x0 is 1 on
that one body. r[601] from odour-food-left (101) = weight(101->601) * 1 = 0.5; r[602] from the same pool = 0
(no edge). So contrast(odour-food) = (0.5 - 0) - (0 - 0.5) = 1.0. The same arithmetic with weight 0.25 gives
contrast(heat) = contrast(touch) = 0.5. taste-mouth's merged pool is {301, 310, 302} (x0 = 1/3 each): edge
301->605 (feed, syn 9, denom 9, weight +1) gives r[605] = 1 * 1/3 = 0.3333; edge 310->603 (forward, syn 6, denom
6, weight -1 since 310 is gaba) gives r[603] = -1 * 1/3 = -0.3333. taste-leg's merged pool is {401, 403} (x0 =
1/2 each): edge 401->604 (backward, syn 7, denom 7, weight +1) gives r[604] = 1 * 1/2 = 0.5. Every value is
identical on the brain graph and the whole graph here (402, 404, 510 and 710 carry no edges and are not
selected into the brain, so the two graphs agree on every value this fixture exercises)."""

import copy
import json
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.admission import admit_all_traced  # noqa: E402
from malecns_brain.errors import ExtractError  # noqa: E402
from malecns_brain.selection_class_seed import resolve_pools, select_class_seed  # noqa: E402

FIXTURE = os.path.join(HERE, "fixtures", "forager-wide-synthetic.json")


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


class FilterKeysTest(unittest.TestCase):
    """entryNerves/excludeReceptorTypes (ADR 007 D15/R6), checked through resolve_pools."""

    def setUp(self):
        self.data = load()
        self.bodies = admitted(self.data)

    def test_entry_nerve_filter_excludes_the_wrong_nerve(self):
        inputs, _ = resolve_pools(self.data["config"], self.bodies)
        # 404 shares subclass/rootSide with 401 but entryNerve MesoLN, not the declared ProLN.
        self.assertNotIn(404, inputs["taste-leg-left"])
        self.assertIn(401, inputs["taste-leg-left"])

    def test_exclude_receptor_types_filter_excludes_ppk(self):
        inputs, _ = resolve_pools(self.data["config"], self.bodies)
        # 402 shares everything with 401 but receptorType putative_ppk23, excluded by the config.
        self.assertNotIn(402, inputs["taste-leg-left"])
        self.assertEqual(inputs["taste-leg-left"], [401])

    def test_absent_keys_behave_exactly_as_format_4(self):
        # Every odour-food/heat/touch channel declares neither key; a plain class+type+rootSide match still works.
        inputs, _ = resolve_pools(self.data["config"], self.bodies)
        self.assertEqual(inputs["odour-food-left"], [101])
        self.assertEqual(inputs["heat-right"], [203])


class PairSideMatchingTest(unittest.TestCase):
    """Side matching grouped by declared pair (ADR 007 D15/R5), not by class/pathway."""

    def test_trivial_pairs_keep_their_one_body_each_side(self):
        data = load()
        inputs, _ = resolve_pools(data["config"], admitted(data))
        self.assertEqual(inputs["odour-food-left"], [101])
        self.assertEqual(inputs["odour-food-right"], [201])
        self.assertEqual(inputs["odour-danger-left"], [102])
        self.assertEqual(inputs["heat-left"], [103])

    def test_touch_keeps_min_per_type_and_drops_the_unmatched_type(self):
        data = load()
        inputs, _ = resolve_pools(data["config"], admitted(data))
        # Type T1 has one body each side (501/502): kept. Type T2 (510) has none on the right: dropped.
        self.assertEqual(inputs["touch-left"], [501])
        self.assertEqual(inputs["touch-right"], [502])

    def test_taste_pairs_are_not_side_matched(self):
        data = load()
        inputs, _ = resolve_pools(data["config"], admitted(data))
        # taste-mouth/taste-leg have sideMatch false: both left bodies of an unbalanced pair are kept.
        self.assertEqual(sorted(inputs["taste-mouth-left"]), [301, 310])
        self.assertEqual(inputs["taste-mouth-right"], [302])

    def test_a_broken_pair_raises_e_pair(self):
        data = load()
        config = copy.deepcopy(data["config"])
        # Both touch channels now claim rootSide "L": the pair no longer resolves to one left and one right.
        config["inputs"]["touch-right"]["rootSide"] = "L"
        with self.assertRaises(ExtractError) as ctx:
            resolve_pools(config, admitted(data, config))
        self.assertEqual(ctx.exception.code, "E-PAIR")


class EscapeOutputTest(unittest.TestCase):
    """Declaring DNp01 (escape) an output drops its outgoing edges, exactly like any other declared output
    (ADR 003 D2, applied to a new output by ADR 007 D17)."""

    def test_escape_body_has_no_outgoing_edge_in_the_brain(self):
        data = load()
        brain = run(data)
        index_of = {n["bodyId"]: n["index"] for n in brain["neurons"]}
        escape_index = index_of[606]
        offsets = brain["offsets"]
        self.assertEqual(offsets[escape_index + 1] - offsets[escape_index], 0)

    def test_escape_pool_still_needs_a_real_inflow_edge(self):
        data = load()
        config = copy.deepcopy(data["config"])
        bodies = admitted(data, config)
        pre, post, syn = edge_table(data)
        # Drop 701 -> 606, escape's only inflow edge.
        keep = post != 606
        edges = (pre[keep], post[keep], syn[keep])
        with self.assertRaises(ExtractError) as ctx:
            select_class_seed(config, bodies, edges)
        self.assertEqual(ctx.exception.code, "E-OUTPUT-UNREACHED")


class FidelityChecksTest(unittest.TestCase):
    """Each declared fidelity.checks entry (ADR 007 D19), against the hand-derived values in this module's
    docstring."""

    def setUp(self):
        self.data = load()
        self.brain = run(self.data)
        self.fidelity = self.brain["fidelity"]
        self.by_kind = {}
        for check in self.fidelity["checks"]:
            key = ("contrast", check["pair"]) if check["kind"] == "contrast" else ("sign", check["from"], check["to"])
            self.by_kind[key] = check

    def test_full_table_has_one_row_per_channel_times_output(self):
        # 12 input channels x 6 outputs.
        self.assertEqual(len(self.fidelity["table"]), 12 * 6)

    def test_contrast_odour_food(self):
        check = self.by_kind[("contrast", "odour-food")]
        self.assertAlmostEqual(check["brainValue"], 1.0, places=5)
        self.assertAlmostEqual(check["wholeGraphValue"], 1.0, places=5)
        self.assertTrue(check["pass"])

    def test_contrast_heat_and_touch(self):
        heat = self.by_kind[("contrast", "heat")]
        touch = self.by_kind[("contrast", "touch")]
        self.assertAlmostEqual(heat["brainValue"], 0.5, places=5)
        self.assertAlmostEqual(touch["brainValue"], 0.5, places=5)
        self.assertTrue(heat["pass"])
        self.assertTrue(touch["pass"])

    def test_sign_taste_mouth_to_feed_and_forward(self):
        feed = self.by_kind[("sign", "taste-mouth", "feed")]
        forward = self.by_kind[("sign", "taste-mouth", "forward")]
        self.assertAlmostEqual(feed["brainValue"], 1 / 3, places=5)
        self.assertAlmostEqual(forward["brainValue"], -1 / 3, places=5)
        self.assertTrue(feed["pass"])
        self.assertTrue(forward["pass"])

    def test_sign_taste_leg_to_backward(self):
        backward = self.by_kind[("sign", "taste-leg", "backward")]
        self.assertAlmostEqual(backward["brainValue"], 0.5, places=5)
        self.assertTrue(backward["pass"])

    def test_require_true_raises_e_fidelity_naming_the_check(self):
        config = copy.deepcopy(self.data["config"])
        config["fidelity"]["require"] = True
        config["fidelity"]["checks"][0]["minFraction"] = 10.0  # odour-food contrast now fails
        with self.assertRaises(ExtractError) as ctx:
            run(self.data, config)
        self.assertEqual(ctx.exception.code, "E-FIDELITY")
        self.assertIn("odour-food", str(ctx.exception))

    def test_undeclared_pair_in_a_check_is_e_config_at_validation(self):
        from malecns_brain.config import validate_forager_wide
        config = copy.deepcopy(self.data["config"])
        config["fidelity"]["checks"][0]["pair"] = "no-such-pair"
        with self.assertRaises(ExtractError) as ctx:
            validate_forager_wide(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")


class DeterminismTest(unittest.TestCase):
    def test_same_config_and_fixture_give_byte_identical_output(self):
        data = load()
        first = run(data)
        second = run(data)
        self.assertEqual(first["neurons"], second["neurons"])
        for name in ("offsets", "targets", "weights", "synapses"):
            self.assertEqual(first[name].tobytes(), second[name].tobytes())
        self.assertEqual(first["fidelity"], second["fidelity"])


if __name__ == "__main__":
    unittest.main()
