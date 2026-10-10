"""Extraction config, format 4 (contracts/extract-config-forager-v2.md): formatVersion-4 dispatch, every schema
key's shape, E-TRANSMITTER-SOURCE and E-CONFIG messages, against the shipped config and mutated copies."""

import copy
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.config import format_of, load_config, validate_forager_v2  # noqa: E402
from malecns_brain.errors import ExtractError  # noqa: E402

CONFIGS = os.path.normpath(os.path.join(HERE, "..", "configs"))
FIXTURE = os.path.join(HERE, "fixtures", "forager-15k-synthetic.json")


def base():
    with open(FIXTURE, encoding="utf-8") as handle:
        return json.load(handle)["config"]


class ConfigForagerV2Test(unittest.TestCase):
    def test_dispatch_pair(self):
        self.assertEqual(format_of({"formatVersion": 4, "kind": "forager"}), "forager")

    def test_base_config_is_valid(self):
        validate_forager_v2(base())

    def test_shipped_config_is_valid_and_dispatches_to_format_4(self):
        config = load_config(os.path.join(CONFIGS, "forager-brain-15k.json"))
        self.assertEqual(config["formatVersion"], 4)
        self.assertEqual(format_of(config), "forager")

    def test_unknown_key(self):
        config = base()
        config["surprise"] = 1
        with self.assertRaises(ExtractError) as caught:
            validate_forager_v2(config)
        self.assertEqual(caught.exception.code, "E-CONFIG")
        self.assertIn("surprise", caught.exception.message)

    def test_synapse_cap_and_output_admission_are_not_format_4_keys(self):
        config = base()
        config["synapseCap"] = 65535
        with self.assertRaises(ExtractError) as caught:
            validate_forager_v2(config)
        self.assertEqual(caught.exception.code, "E-CONFIG")
        self.assertIn("synapseCap", caught.exception.message)

    def test_transmitter_source_must_name_readable_columns(self):
        config = base()
        config["transmitterSource"] = ["ground_truth", "nonexistent_column"]
        with self.assertRaises(ExtractError) as caught:
            validate_forager_v2(config)
        self.assertEqual(caught.exception.code, "E-TRANSMITTER-SOURCE")
        self.assertIn("nonexistent_column", caught.exception.message)

    def test_transmitter_source_must_be_non_empty(self):
        config = base()
        config["transmitterSource"] = []
        with self.assertRaises(ExtractError) as caught:
            validate_forager_v2(config)
        self.assertEqual(caught.exception.code, "E-TRANSMITTER-SOURCE")

    def test_weight_rule_accepts_synapse_count(self):
        config = base()
        config["weightRule"] = "synapseCount"
        validate_forager_v2(config)  # must not raise

    def test_weight_rule_rejects_unknown_value(self):
        config = base()
        config["weightRule"] = "cap"
        with self.assertRaises(ExtractError) as caught:
            validate_forager_v2(config)
        self.assertEqual(caught.exception.code, "E-CONFIG")
        self.assertIn("synapseCount", caught.exception.message)

    def test_min_synapses_is_optional_and_defaults(self):
        config = base()
        del config["minSynapses"]
        validate_forager_v2(config)  # must not raise

    def test_min_synapses_must_be_positive(self):
        config = base()
        config["minSynapses"] = 0
        with self.assertRaises(ExtractError) as caught:
            validate_forager_v2(config)
        self.assertEqual(caught.exception.code, "E-CONFIG")

    def test_budget_is_an_object_with_per_pair(self):
        config = base()
        config["budget"] = {"odour": 1500}
        with self.assertRaises(ExtractError) as caught:
            validate_forager_v2(config)
        self.assertEqual(caught.exception.code, "E-CONFIG")
        self.assertIn("perPair", caught.exception.message)

    def test_anchors_may_be_empty(self):
        config = base()
        config["anchors"] = []
        validate_forager_v2(config)  # must not raise

    def test_output_groups_must_name_declared_outputs(self):
        config = base()
        config["outputGroups"]["turn"] = ["turn-left", "bogus-output"]
        with self.assertRaises(ExtractError) as caught:
            validate_forager_v2(config)
        self.assertEqual(caught.exception.code, "E-CONFIG")

    def test_side_match_must_cover_every_pathway(self):
        config = base()
        del config["sideMatch"]["heat"]
        with self.assertRaises(ExtractError) as caught:
            validate_forager_v2(config)
        self.assertEqual(caught.exception.code, "E-CONFIG")

    def test_modulator_targets_must_be_declared_inputs(self):
        config = copy.deepcopy(base())
        config["modulators"][0]["targets"] = ["feed"]
        with self.assertRaises(ExtractError) as caught:
            validate_forager_v2(config)
        self.assertEqual(caught.exception.code, "E-MODULATOR")


if __name__ == "__main__":
    unittest.main()
