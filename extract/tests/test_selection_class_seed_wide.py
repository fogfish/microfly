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
from malecns_brain.selection_class_seed import (  # noqa: E402
    apply_threshold, partner_seeds, resolve_pools, seed_bodies, select_class_seed,
)

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

def with_partners(data):
    """The fixture plus four labelled SYNTHETIC bodies for ADR 009 D24: 720 sends 5 synapses onto output 601 (a
    partner), 721 sends 4 (below minSynapses), 722 only receives from 601 (downstream, not a partner), 730 is a
    gustatory body (never a fill or partner candidate) that sends 6 onto 601. 701 (seed class SEEDCLS) already
    sends 5 onto output 606, so it is both a class seed and a partner."""
    data = copy.deepcopy(data)
    template = next(a for a in data["annotations"] if a["bodyId"] == 710)
    for body, cls in ((720, "intrinsic"), (721, "intrinsic"), (722, "intrinsic"), (730, "gustatory")):
        data["annotations"].append({**template, "bodyId": body, "class": cls, "status": "Traced",
                                    "type": f"SYN_{body}"})
        data["transmitters"].append({"body": body, "consensus_nt": "acetylcholine"})
    for pre, post, syn in ((720, 601, 5), (721, 601, 4), (601, 722, 9), (730, 601, 6)):
        data["edges"]["pre"].append(pre)
        data["edges"]["post"].append(post)
        data["edges"]["synapses"].append(syn)
    data["config"]["seeds"] = data["config"]["seeds"] + [{"partnersOf": "outputs"}]
    return data


class PartnerSeedTest(unittest.TestCase):
    """ADR 009 D24: {"partnersOf": "outputs"} seeds the presynaptic partners of the output pools."""

    def setUp(self):
        self.data = with_partners(load())
        self.config = self.data["config"]
        self.bodies = admitted(self.data)
        inputs, outputs = resolve_pools(self.config, self.bodies)
        self.outputs = {b for members in outputs.values() for b in members}
        self.pools = self.outputs | {b for members in inputs.values() for b in members}
        self.edges = apply_threshold(edge_table(self.data), self.config["minSynapses"])

    def test_partner_at_min_synapses_is_seeded(self):
        self.assertEqual(partner_seeds(self.config, self.bodies, self.edges, self.outputs, self.pools)[720], "seed:outputPartner")

    def test_below_threshold_downstream_and_sensory_bodies_are_not(self):
        partners = partner_seeds(self.config, self.bodies, self.edges, self.outputs, self.pools)
        for body in (721, 722, 730):
            self.assertNotIn(body, partners)
        # 103/203 (heat) and 501/502 (touch) send onto outputs but are input pool bodies.
        self.assertFalse(set(partners) & self.pools)
        self.assertEqual(sorted(partners), [701, 720])

    def test_no_partner_filter_means_no_partner_seeds(self):
        config = {**self.config, "seeds": [s for s in self.config["seeds"] if "partnersOf" not in s]}
        self.assertEqual(partner_seeds(config, self.bodies, self.edges, self.outputs, self.pools), {})

    def test_brain_tags_partners_and_keeps_the_class_tag(self):
        config = {**self.config, "fill": {**self.config["fill"], "neuronCount": 100}}
        brain = select_class_seed(config, self.bodies, edge_table(self.data))
        origin = {n["bodyId"]: n["origin"] for n in brain["neurons"]}
        self.assertEqual(origin[720], "seed:outputPartner")
        self.assertEqual(origin[701], "seed:SEEDCLS")
        self.assertNotIn(730, origin)

    def test_partner_seeds_count_as_seeds(self):
        config = {**self.config, "fill": {**self.config["fill"], "neuronCount": 100}}
        base = run(self.data, {**config, "seeds": [s for s in config["seeds"] if "partnersOf" not in s]})
        brain = run(self.data, config)
        self.assertEqual(brain["seedCount"], base["seedCount"] + 1)  # 720 only; 701 was a seed already


def with_class_seeded_input_pool(data):
    """ADR 011 (specs/019-mb-valence-learning §6 open risk): two labelled SYNTHETIC bodies of the already-seeded
    class SEEDCLS (720 L, 721 R), also declared as a new `reinforcement` input pair. This mirrors a PAM/PPL1 DAN
    body that is both named by seeds[].class and a declared reinforcement-* input pool. fill.neuronCount is
    raised by 2 to keep room for them beside the fixture's existing 20-body selection."""
    data = copy.deepcopy(data)
    template = next(a for a in data["annotations"] if a["bodyId"] == 701)
    for body, side in ((720, "L"), (721, "R")):
        data["annotations"].append({**template, "bodyId": body, "rootSide": side, "type": "SC_B"})
        data["transmitters"].append({"body": body, "consensus_nt": "acetylcholine"})
    config = data["config"]
    config["inputs"] = {
        **config["inputs"],
        "reinforcement-left": {"class": "SEEDCLS", "pair": "reinforcement", "types": ["SC_B"], "rootSide": "L"},
        "reinforcement-right": {"class": "SEEDCLS", "pair": "reinforcement", "types": ["SC_B"], "rootSide": "R"},
    }
    config["sideMatch"] = {**config["sideMatch"], "reinforcement": True}
    config["fill"] = {**config["fill"], "neuronCount": config["fill"]["neuronCount"] + 2}
    # resolve_pools walks _input_order, which reads capabilities.channels.inputs, not config["inputs"] directly.
    config["capabilities"] = copy.deepcopy(config["capabilities"])
    config["capabilities"]["channels"]["inputs"] += [
        {"id": "reinforcement-left", "label": "Reinforcement left", "range": [0, 1],
         "sense": "reinforcement", "side": "L", "site": "central"},
        {"id": "reinforcement-right", "label": "Reinforcement right", "range": [0, 1],
         "sense": "reinforcement", "side": "R", "site": "central"},
    ]
    return data


class ClassSeededInputPoolTest(unittest.TestCase):
    """A body matching both a seeds[].class filter and a declared input pool (ADR 011 §6 open risk: a DAN named
    by seeds[].class: DAN and by a declared reinforcement-* pool) must move to the input section, must not raise
    the existing "a body is a member of two pools" E-CONFIG rule, and must not be double-counted in seedCount."""

    def setUp(self):
        self.data = with_class_seeded_input_pool(load())

    def test_no_member_of_two_pools_error(self):
        run(self.data)  # raises E-CONFIG on failure

    def test_moves_to_the_input_section_not_interneuron(self):
        brain = run(self.data)
        by_body = {n["bodyId"]: n for n in brain["neurons"]}
        self.assertEqual(by_body[720]["role"], "input")
        self.assertEqual(by_body[720]["channel"], "reinforcement-left")
        self.assertEqual(by_body[721]["role"], "input")
        self.assertEqual(by_body[721]["channel"], "reinforcement-right")

    def test_not_double_counted_against_seed_count_or_fill(self):
        base = run(load())
        brain = run(self.data)
        # 720 and 721 are new: +2 to seedCount (pool membership), never +4 (which double-counting via both the
        # class seed and the pool would give), and fillCount is unaffected since neither needed fill.
        self.assertEqual(brain["seedCount"], base["seedCount"] + 2)
        self.assertEqual(brain["fillCount"], base["fillCount"])
        self.assertEqual(len(brain["neurons"]), len(base["neurons"]) + 2)


def with_type_seeds(data):
    """ADR 012 research R4: two labelled SYNTHETIC bodies for seeds[].types/typePrefixes, added beside the
    fixture's existing class seed (701, class SEEDCLS, type SC_A). 740 is matched only by a `types` filter;
    741 only by a `typePrefixes` filter."""
    data = copy.deepcopy(data)
    template = next(a for a in data["annotations"] if a["bodyId"] == 701)
    for body, type_ in ((740, "SC_TYPED"), (741, "SCPFX_1")):
        # class "intrinsic", not "SEEDCLS": these two must be matched only by their own types/typePrefixes
        # filter, not by the fixture's existing {"class": ["SEEDCLS"]} filter.
        data["annotations"].append({**template, "bodyId": body, "type": type_, "class": "intrinsic"})
        data["transmitters"].append({"body": body, "consensus_nt": "acetylcholine"})
    data["config"]["seeds"] = data["config"]["seeds"] + [
        {"types": ["SC_TYPED"]}, {"typePrefixes": ["SCPFX"]},
    ]
    return data


class TypeSeedTest(unittest.TestCase):
    """seeds[].types / seeds[].typePrefixes (ADR 012 research R4), checked through seed_bodies."""

    def test_types_filter_tags_the_matching_body_seed_type(self):
        data = with_type_seeds(load())
        seeds = seed_bodies(data["config"], admitted(data))
        self.assertEqual(seeds[740], "seed:type")

    def test_type_prefixes_filter_tags_the_matching_body_seed_type(self):
        data = with_type_seeds(load())
        seeds = seed_bodies(data["config"], admitted(data))
        self.assertEqual(seeds[741], "seed:type")

    def test_body_already_tagged_by_a_class_seed_keeps_its_class_tag(self):
        # 701 matches both the fixture's existing {"class": ["SEEDCLS"]} filter and a new types filter on its
        # own type SC_A; the class filter runs first in seeds[] order, and that tag must win.
        data = with_type_seeds(load())
        data["config"]["seeds"] = data["config"]["seeds"] + [{"types": ["SC_A"]}]
        seeds = seed_bodies(data["config"], admitted(data))
        self.assertEqual(seeds[701], "seed:SEEDCLS")

    def test_unmatched_types_entry_raises_e_seed_empty_naming_the_type(self):
        data = with_type_seeds(load())
        data["config"]["seeds"] = data["config"]["seeds"] + [{"types": ["NO_SUCH_TYPE"]}]
        with self.assertRaises(ExtractError) as ctx:
            seed_bodies(data["config"], admitted(data))
        self.assertEqual(ctx.exception.code, "E-SEED-EMPTY")
        self.assertIn("NO_SUCH_TYPE", str(ctx.exception))

    def test_unmatched_type_prefixes_filter_raises_e_seed_empty(self):
        data = with_type_seeds(load())
        data["config"]["seeds"] = data["config"]["seeds"] + [{"typePrefixes": ["NO_SUCH_PREFIX"]}]
        with self.assertRaises(ExtractError) as ctx:
            seed_bodies(data["config"], admitted(data))
        self.assertEqual(ctx.exception.code, "E-SEED-EMPTY")


def with_receptor_pair(data, second_pair=False):
    """ADR 012 research R1/R3: a `contact-pheromone` input pair sharing taste-leg's subclass/entryNerve but
    filtered by `receptorTypes` instead of `excludeReceptorTypes`. 402 (L, already in the fixture, receptorType
    putative_ppk23) and a new body 405 (R, same receptorType) are its only matches: disjoint from taste-leg
    (401/403, receptorType None), which excludes putative_ppk23. `second_pair` adds a further pair declaring
    the same filter, so it resolves to the same bodies and triggers the resolved E-POOL-OVERLAP check."""
    data = copy.deepcopy(data)
    template = next(a for a in data["annotations"] if a["bodyId"] == 402)
    data["annotations"].append({**template, "bodyId": 405, "rootSide": "R"})
    data["transmitters"].append({"body": 405, "consensus_nt": "acetylcholine"})
    config = data["config"]
    config["inputs"] = {
        **config["inputs"],
        "contact-pheromone-left": {
            "pair": "contact-pheromone", "class": "gustatory", "subclasses": ["leg bristle"],
            "entryNerves": ["ProLN"], "receptorTypes": ["putative_ppk23"], "rootSide": "L",
        },
        "contact-pheromone-right": {
            "pair": "contact-pheromone", "class": "gustatory", "subclasses": ["leg bristle"],
            "entryNerves": ["ProLN"], "receptorTypes": ["putative_ppk23"], "rootSide": "R",
        },
    }
    config["sideMatch"] = {**config["sideMatch"], "contact-pheromone": False}
    config["capabilities"] = copy.deepcopy(config["capabilities"])
    config["capabilities"]["channels"]["inputs"] += [
        {"id": "contact-pheromone-left", "label": "Contact pheromone left", "range": [0, 1],
         "sense": "contact:pheromone", "side": "L", "site": "front-leg"},
        {"id": "contact-pheromone-right", "label": "Contact pheromone right", "range": [0, 1],
         "sense": "contact:pheromone", "side": "R", "site": "front-leg"},
    ]
    if second_pair:
        config["inputs"]["contact-pheromone2-left"] = {
            **config["inputs"]["contact-pheromone-left"], "pair": "contact-pheromone2",
        }
        config["inputs"]["contact-pheromone2-right"] = {
            **config["inputs"]["contact-pheromone-right"], "pair": "contact-pheromone2",
        }
        config["sideMatch"]["contact-pheromone2"] = False
        config["capabilities"]["channels"]["inputs"] += [
            {"id": "contact-pheromone2-left", "label": "Contact pheromone 2 left", "range": [0, 1],
             "sense": "contact:pheromone", "side": "L", "site": "front-leg"},
            {"id": "contact-pheromone2-right", "label": "Contact pheromone 2 right", "range": [0, 1],
             "sense": "contact:pheromone", "side": "R", "site": "front-leg"},
        ]
    return data


class ReceptorTypesFilterTest(unittest.TestCase):
    """inputs[cid].receptorTypes (ADR 012 research R1/R3), checked through resolve_pools."""

    def test_receptor_types_keeps_only_the_listed_receptor_type(self):
        data = with_receptor_pair(load())
        inputs, _ = resolve_pools(data["config"], admitted(data))
        self.assertEqual(inputs["contact-pheromone-left"], [402])
        self.assertEqual(inputs["contact-pheromone-right"], [405])

    def test_disjoint_from_taste_leg_on_the_same_subclass(self):
        data = with_receptor_pair(load())
        inputs, _ = resolve_pools(data["config"], admitted(data))
        self.assertEqual(inputs["taste-leg-left"], [401])  # unchanged: still excludes 402
        self.assertFalse(set(inputs["taste-leg-left"]) & set(inputs["contact-pheromone-left"]))

    def test_two_pairs_resolving_to_the_same_bodies_raise_e_pool_overlap(self):
        data = with_receptor_pair(load(), second_pair=True)
        with self.assertRaises(ExtractError) as ctx:
            resolve_pools(data["config"], admitted(data))
        self.assertEqual(ctx.exception.code, "E-POOL-OVERLAP")
        self.assertIn("contact-pheromone", str(ctx.exception))
        self.assertIn("402", str(ctx.exception))


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
