"""Config validation (contracts/extract-config.md, E-CONFIG)."""

import copy
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.config import config_hash, load_config  # noqa: E402
from malecns_brain.errors import ExtractError  # noqa: E402

REFERENCE = os.path.normpath(os.path.join(HERE, "..", "configs", "smallest-functional-brain.json"))


def reference():
    with open(REFERENCE, "r", encoding="utf-8") as handle:
        return json.load(handle)


class ConfigTest(unittest.TestCase):
    def write(self, text):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = os.path.join(directory.name, "config.json")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(text)
        return path

    def assertInvalid(self, config, fragment):
        path = self.write(json.dumps(config))
        with self.assertRaises(ExtractError) as caught:
            load_config(path)
        self.assertEqual(caught.exception.code, "E-CONFIG")
        self.assertIn(fragment, caught.exception.message)

    def test_reference_config_loads(self):
        config = load_config(REFERENCE)
        self.assertEqual(config["synapseCap"], 5)
        self.assertEqual(config["readouts"]["somaSides"], ["L", "R"])

    def test_unknown_key_is_rejected(self):
        config = reference()
        config["datasetDir"] = "/somewhere"
        self.assertInvalid(config, "unknown key: datasetDir")

    def test_min_confidence_above_one_is_rejected(self):
        config = reference()
        config["minConfidence"] = 1.5
        self.assertInvalid(config, "minConfidence must be a number in [0, 1]")

    def test_max_below_min_is_rejected(self):
        config = reference()
        config["maxInterneurons"] = 1
        self.assertInvalid(config, "maxInterneurons must be ≥ minInterneurons (2)")

    def test_soma_sides_must_be_l_and_r(self):
        config = reference()
        config["readouts"]["somaSides"] = ["L"]
        self.assertInvalid(config, 'readouts.somaSides must be exactly ["L","R"]')

    def test_transmitter_sign_must_be_plus_or_minus_one(self):
        config = reference()
        config["transmitterSign"]["acetylcholine"] = 2
        self.assertInvalid(config, "transmitterSign value for acetylcholine must be 1 or -1")

    def test_expected_neuron_count_below_three_is_rejected(self):
        config = reference()
        config["expectedNeuronCount"] = 2
        self.assertInvalid(config, "expectedNeuronCount must be null or an integer ≥ 3")

    def test_malformed_json_is_rejected(self):
        path = self.write('{"formatVersion": 2,')
        with self.assertRaises(ExtractError) as caught:
            load_config(path)
        self.assertEqual(caught.exception.code, "E-CONFIG")
        self.assertIn("malformed JSON", caught.exception.message)

    def test_config_hash_is_stable_across_key_order(self):
        config = reference()
        shuffled = dict(reversed(list(copy.deepcopy(config).items())))
        self.assertEqual(config_hash(config), config_hash(shuffled))
        self.assertTrue(config_hash(config).startswith("sha256:"))


if __name__ == "__main__":
    unittest.main()
