"""Config validation for formatVersion 5, kind "forager-wide", selection "classSeed"
(contracts/extract-config-forager-wide.md, ADR 007 D20)."""

import copy
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.config import format_of, validate_forager_wide  # noqa: E402
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


if __name__ == "__main__":
    unittest.main()
