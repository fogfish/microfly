"""Config validation for formatVersion 5, kind "forager-wide", selection "classSeed"
(contracts/extract-config-forager-wide.md, ADR 007 D20)."""

import copy
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.config import _check_pool_overlap, _check_seed_filters, format_of, validate_forager_wide  # noqa: E402
from malecns_brain.errors import ExtractError  # noqa: E402

CONFIG_PATH = os.path.join(HERE, "..", "configs", "forager-brain-wide.json")


def shipped_config():
    with open(CONFIG_PATH, encoding="utf-8") as handle:
        return json.load(handle)


class FormatOfTest(unittest.TestCase):
    def test_dispatches_the_shipped_config_to_forager_wide(self):
        self.assertEqual(format_of(shipped_config()), "foragerWide")

    def test_wrong_kind_is_e_config(self):
        config = copy.deepcopy(shipped_config())
        config["kind"] = "forager"
        with self.assertRaises(ExtractError) as ctx:
            format_of(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_missing_selection_is_e_config(self):
        config = copy.deepcopy(shipped_config())
        del config["selection"]
        with self.assertRaises(ExtractError) as ctx:
            format_of(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")


class ValidateForagerWideTest(unittest.TestCase):
    def test_accepts_the_shipped_config_shape(self):
        validate_forager_wide(shipped_config())  # raises on failure

    def test_rejects_each_flow_strategy_only_key(self):
        for key, value in (("pathways", {}), ("flowSteps", 5), ("budget", {"odour": 1, "taste": 1}),
                            ("outputAdmission", "low-confidence-sign-zero"), ("minConfidence", 0.5)):
            config = copy.deepcopy(shipped_config())
            config[key] = value
            with self.assertRaises(ExtractError) as ctx:
                validate_forager_wide(config)
            self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_rejects_wrong_format_version(self):
        config = copy.deepcopy(shipped_config())
        config["formatVersion"] = 4
        with self.assertRaises(ExtractError) as ctx:
            validate_forager_wide(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_pair_is_required_on_every_input(self):
        config = copy.deepcopy(shipped_config())
        del config["inputs"]["odour-food-left"]["pair"]
        with self.assertRaises(ExtractError) as ctx:
            validate_forager_wide(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_side_match_must_be_keyed_by_every_declared_pair(self):
        config = copy.deepcopy(shipped_config())
        del config["sideMatch"]["heat"]
        with self.assertRaises(ExtractError) as ctx:
            validate_forager_wide(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_side_match_keyed_by_pathway_like_format_4_is_rejected(self):
        config = copy.deepcopy(shipped_config())
        config["sideMatch"] = {"odour": True, "taste": False}
        with self.assertRaises(ExtractError) as ctx:
            validate_forager_wide(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_fidelity_checks_entry_naming_an_undeclared_pair_is_e_config(self):
        config = copy.deepcopy(shipped_config())
        config["fidelity"]["checks"][0]["pair"] = "no-such-pair"
        with self.assertRaises(ExtractError) as ctx:
            validate_forager_wide(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_fidelity_checks_entry_naming_an_undeclared_from_is_e_config(self):
        config = copy.deepcopy(shipped_config())
        config["fidelity"]["checks"][1]["from"] = "no-such-pair"
        with self.assertRaises(ExtractError) as ctx:
            validate_forager_wide(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_fidelity_checks_entry_naming_an_undeclared_output_is_e_config(self):
        config = copy.deepcopy(shipped_config())
        config["fidelity"]["checks"][1]["to"] = "no-such-output"
        with self.assertRaises(ExtractError) as ctx:
            validate_forager_wide(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_min_contrast_fraction_is_not_a_format_5_key(self):
        config = copy.deepcopy(shipped_config())
        config["fidelity"]["minContrastFraction"] = 0.1
        with self.assertRaises(ExtractError) as ctx:
            validate_forager_wide(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_outputs_may_declare_escape(self):
        config = shipped_config()
        self.assertIn("escape", config["outputs"])
        self.assertEqual(config["outputs"]["escape"]["types"], ["DNp01"])

    def test_entry_nerves_and_exclude_receptor_types_are_optional_string_lists(self):
        config = copy.deepcopy(shipped_config())
        config["inputs"]["taste-leg-left"]["entryNerves"] = "not-a-list"
        with self.assertRaises(ExtractError) as ctx:
            validate_forager_wide(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_partners_of_outputs_is_a_format_5_seed_filter(self):
        # ADR 009 D24.
        config = copy.deepcopy(shipped_config())
        self.assertIn({"partnersOf": "outputs"}, config["seeds"])
        validate_forager_wide(config)  # raises on failure

    def test_partners_of_anything_but_outputs_is_e_config(self):
        for bad in ({"partnersOf": "inputs"}, {"partnersOf": "outputs", "class": ["MBON"]}):
            config = copy.deepcopy(shipped_config())
            config["seeds"] = [s for s in config["seeds"] if "partnersOf" not in s] + [bad]
            with self.assertRaises(ExtractError) as ctx:
                validate_forager_wide(config)
            self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_partners_of_twice_is_e_config(self):
        config = copy.deepcopy(shipped_config())
        config["seeds"] = config["seeds"] + [{"partnersOf": "outputs"}]
        with self.assertRaises(ExtractError) as ctx:
            validate_forager_wide(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_the_shipped_non_overlapping_pairs_pass(self):
        # ADR 011, specs/019-mb-valence-learning §1: no shipped pair declares an ORN type another pair declares.
        validate_forager_wide(shipped_config())  # raises on failure

    def test_two_input_pairs_sharing_a_type_is_e_pool_overlap(self):
        # ADR 011: a second olfactory pair reusing odour-food's DM1 type must fail, naming both pairs.
        config = copy.deepcopy(shipped_config())
        config["inputs"]["odour-food2-left"] = {
            "pair": "odour-food2", "class": "olfactory", "types": ["ORN_DM1"], "rootSide": "L",
        }
        config["inputs"]["odour-food2-right"] = {
            "pair": "odour-food2", "class": "olfactory", "types": ["ORN_DM1"], "rootSide": "R",
        }
        config["sideMatch"]["odour-food2"] = True
        with self.assertRaises(ExtractError) as ctx:
            validate_forager_wide(config)
        self.assertEqual(ctx.exception.code, "E-POOL-OVERLAP")
        self.assertIn("odour-food", str(ctx.exception))
        self.assertIn("odour-food2", str(ctx.exception))

    def test_overlapping_pairs_of_different_classes_do_not_collide(self):
        # Different classes can never match the same body (selection_forager._matches_input checks class first),
        # so a shared type name across classes must not raise E-POOL-OVERLAP.
        inputs = {
            "odour-food-left": {"pair": "odour-food", "class": "olfactory", "types": ["ORN_DM1"], "rootSide": "L"},
            "odour-food-right": {"pair": "odour-food", "class": "olfactory", "types": ["ORN_DM1"], "rootSide": "R"},
            "taste-food-left": {"pair": "taste-food", "class": "gustatory", "types": ["ORN_DM1"], "rootSide": "L"},
            "taste-food-right": {"pair": "taste-food", "class": "gustatory", "types": ["ORN_DM1"], "rootSide": "R"},
        }
        _check_pool_overlap(inputs)  # raises on failure

    def test_receptor_filter_on_either_side_skips_the_declared_set_check(self):
        # ADR 012 research R3: contact-pheromone's receptorTypes include-filter and taste-leg's
        # excludeReceptorTypes both declare subclass "leg bristle"; the declared-set check must not collide them.
        inputs = {
            "taste-leg-left": {
                "pair": "taste-leg", "class": "gustatory", "subclasses": ["leg bristle"],
                "excludeReceptorTypes": ["putative_ppk23", "putative_ppk25"], "rootSide": "L",
            },
            "taste-leg-right": {
                "pair": "taste-leg", "class": "gustatory", "subclasses": ["leg bristle"],
                "excludeReceptorTypes": ["putative_ppk23", "putative_ppk25"], "rootSide": "R",
            },
            "contact-pheromone-left": {
                "pair": "contact-pheromone", "class": "gustatory", "subclasses": ["leg bristle"],
                "receptorTypes": ["putative_ppk23", "putative_ppk25"], "rootSide": "L",
            },
            "contact-pheromone-right": {
                "pair": "contact-pheromone", "class": "gustatory", "subclasses": ["leg bristle"],
                "receptorTypes": ["putative_ppk23", "putative_ppk25"], "rootSide": "R",
            },
        }
        _check_pool_overlap(inputs)  # raises on failure


class SeedFilterTypeTest(unittest.TestCase):
    """seeds[] filters by `types`/`typePrefixes` (ADR 012 research R4), alongside class/superclass."""

    def test_types_filter_is_valid(self):
        _check_seed_filters([{"types": ["pIP10"]}], allow_partners=True)  # raises on failure

    def test_type_prefixes_filter_is_valid(self):
        _check_seed_filters([{"typePrefixes": ["pC1_", "mAL4"]}], allow_partners=True)  # raises on failure

    def test_two_of_four_keys_fails(self):
        for filt in (
            {"class": ["ALPN"], "types": ["pIP10"]},
            {"superclass": ["descending_neuron"], "typePrefixes": ["pC1_"]},
            {"types": ["pIP10"], "typePrefixes": ["pC1_"]},
        ):
            with self.assertRaises(ExtractError) as ctx:
                _check_seed_filters([filt], allow_partners=True)
            self.assertEqual(ctx.exception.code, "E-CONFIG")
            self.assertIn("exactly one of class, superclass, types or typePrefixes", str(ctx.exception))

    def test_empty_list_fails(self):
        with self.assertRaises(ExtractError) as ctx:
            _check_seed_filters([{"types": []}], allow_partners=True)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_non_string_entry_fails(self):
        with self.assertRaises(ExtractError) as ctx:
            _check_seed_filters([{"typePrefixes": ["pC1_", 7]}], allow_partners=True)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_unknown_key_in_a_type_filter_fails(self):
        with self.assertRaises(ExtractError) as ctx:
            _check_seed_filters([{"types": ["pIP10"], "note": "extra"}], allow_partners=True)
        self.assertEqual(ctx.exception.code, "E-CONFIG")
        self.assertIn("unknown key in seeds[0]", str(ctx.exception))


class ReceptorTypesInputFilterTest(unittest.TestCase):
    """inputs[cid].receptorTypes (ADR 012 research R1/R3): the include-filter complement of
    excludeReceptorTypes."""

    def _config_with(self, extra):
        config = copy.deepcopy(shipped_config())
        config["inputs"]["contact-pheromone-left"] = {
            "pair": "contact-pheromone", "class": "gustatory", "subclasses": ["leg bristle"],
            "entryNerves": ["ProLN"], "rootSide": "L", **extra,
        }
        config["inputs"]["contact-pheromone-right"] = {
            "pair": "contact-pheromone", "class": "gustatory", "subclasses": ["leg bristle"],
            "entryNerves": ["ProLN"], "rootSide": "R", **extra,
        }
        config["sideMatch"]["contact-pheromone"] = True
        config["capabilities"] = copy.deepcopy(config["capabilities"])
        config["capabilities"]["channels"]["inputs"] += [
            {"id": "contact-pheromone-left", "label": "Contact pheromone left", "side": "L", "range": [0, 1],
             "sense": "contact:pheromone", "site": "front-leg"},
            {"id": "contact-pheromone-right", "label": "Contact pheromone right", "side": "R", "range": [0, 1],
             "sense": "contact:pheromone", "site": "front-leg"},
        ]
        return config

    def test_receptor_types_is_a_valid_non_empty_string_list(self):
        config = self._config_with({"receptorTypes": ["putative_ppk23", "putative_ppk25"]})
        validate_forager_wide(config)  # raises on failure

    def test_receptor_types_and_exclude_receptor_types_together_is_e_config(self):
        config = self._config_with({
            "receptorTypes": ["putative_ppk23"], "excludeReceptorTypes": ["putative_ppk25"],
        })
        with self.assertRaises(ExtractError) as ctx:
            validate_forager_wide(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")


class SongOutputTest(unittest.TestCase):
    """outputs[cid].drive "song" (ADR 012 R12): allowed, and at most once."""

    def _config_with_song(self, config=None):
        config = copy.deepcopy(config or shipped_config())
        config["outputs"]["song"] = {"types": ["pIP10"], "drive": "song"}
        config["capabilities"] = copy.deepcopy(config["capabilities"])
        config["capabilities"]["channels"]["outputs"].append(
            {"id": "song", "label": "Song", "side": "both", "range": [0, 1], "drive": "song"}
        )
        return config

    def test_song_output_once_is_valid(self):
        validate_forager_wide(self._config_with_song())  # raises on failure

    def test_song_output_twice_is_e_config(self):
        config = self._config_with_song()
        config["outputs"]["song2"] = {"types": ["pIP10"], "drive": "song"}
        config["capabilities"]["channels"]["outputs"].append(
            {"id": "song2", "label": "Song 2", "side": "both", "range": [0, 1], "drive": "song"}
        )
        with self.assertRaises(ExtractError) as ctx:
            validate_forager_wide(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")


if __name__ == "__main__":
    unittest.main()
