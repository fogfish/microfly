"""Extraction config, format 3 (contracts/extract-config-forager.md): dispatch pairs, C1, the forager keys and
E-MODULATOR. The base config is the ADR 003 D6 config written from the contract."""

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.config import format_of, load_config, validate_forager  # noqa: E402
from malecns_brain.errors import ExtractError  # noqa: E402

CONFIGS = os.path.normpath(os.path.join(HERE, "..", "configs"))

ODOUR_TYPES = ["ORN_DM1", "ORN_DM2", "ORN_DM4", "ORN_VA2", "ORN_VM2", "ORN_DP1m"]


def base():
    """The format 3 config. Channels in `capabilities` carry no neurons: the extractor adds them after selection."""
    def channel(id_, label, side, drive=None, rng=(0, 1)):
        ch = {"id": id_, "label": label, "side": side, "range": list(rng)}
        if drive is not None:
            ch["drive"] = drive
        return ch

    return {
        "formatVersion": 3,
        "kind": "forager",
        "datasetRelease": "male-cns-v1.0",
        "edgeVariant": "traced-only",
        "expect": {"annotationRows": 1, "edgeRows": 1, "neurotransmitterRows": 1},
        "transmitterSign": {"acetylcholine": 1, "gaba": -1, "glutamate": -1},
        "minConfidence": 0.5,
        "synapseCap": 65535,
        "inputs": {
            "odour-left": {"class": "olfactory", "types": ODOUR_TYPES, "rootSide": "L"},
            "odour-right": {"class": "olfactory", "types": ODOUR_TYPES, "rootSide": "R"},
            "taste-left": {"class": "gustatory", "subclasses": ["labellar bristle", "taste peg"],
                           "typePrefixes": ["LgLG"], "rootSide": "L"},
            "taste-right": {"class": "gustatory", "subclasses": ["labellar bristle", "taste peg"],
                            "typePrefixes": ["LgLG"], "rootSide": "R"},
        },
        "sideMatch": {"odour": True, "taste": False},
        "outputs": {
            "turn-left": {"types": ["DNa01", "DNa02"], "somaSide": "L", "drive": "turnLeft"},
            "turn-right": {"types": ["DNa01", "DNa02"], "somaSide": "R", "drive": "turnRight"},
            "forward": {"types": ["DNp09"], "drive": "forward"},
            "backward": {"types": ["MDN"], "drive": "backward"},
            "feed": {"types": ["MN9"], "drive": "feed"},
        },
        "pathways": {"odour": ["odour-left", "odour-right"], "taste": ["taste-left", "taste-right"]},
        "flowSteps": 5,
        "budget": {"odour": 1500, "taste": 1500},
        "excludeInterneuronClasses": ["olfactory", "gustatory"],
        "excludeInterneuronSuperclassSuffix": "_sensory",
        "weightRule": "postFraction",
        "outputAdmission": "low-confidence-sign-zero",
        "modulators": [
            {"id": "hunger", "label": "Hunger", "range": [0, 1], "gain": [0.5, 1.5],
             "targets": ["odour-left", "odour-right"]},
            {"id": "hunger-taste", "label": "Hunger taste", "source": "hunger", "gain": [0.1, 1.5],
             "targets": ["taste-left", "taste-right"]},
        ],
        "capabilities": {
            "signals": ["spikes"],
            "channels": {
                "inputs": [
                    channel("odour-left", "Odour left", "L"),
                    channel("odour-right", "Odour right", "R"),
                    channel("taste-left", "Taste left", "L"),
                    channel("taste-right", "Taste right", "R"),
                ],
                "outputs": [
                    channel("turn-left", "Turn left", "L", "turnLeft"),
                    channel("turn-right", "Turn right", "R", "turnRight"),
                    channel("forward", "Forward", "both", "forward"),
                    channel("backward", "Backward", "both", "backward"),
                    channel("feed", "Feed", "both", "feed"),
                ],
            },
        },
        "expectedNeuronCount": None,
        "neuronCountRange": [2000, 6000],
    }


class ConfigForagerTest(unittest.TestCase):
    def test_dispatch_pairs(self):
        self.assertEqual(format_of({"formatVersion": 2}), "small")
        self.assertEqual(format_of({"formatVersion": 3, "kind": "forager"}), "forager")

    def test_other_pairs_name_the_key(self):
        with self.assertRaises(ExtractError) as caught:
            format_of({"formatVersion": 3})
        self.assertEqual(caught.exception.code, "E-CONFIG")
        self.assertIn("kind", caught.exception.message)
        with self.assertRaises(ExtractError) as caught:
            format_of({"formatVersion": 2, "kind": "forager"})
        self.assertIn("kind", caught.exception.message)
        with self.assertRaises(ExtractError) as caught:
            format_of({"formatVersion": 3, "kind": "tank"})
        self.assertIn("kind", caught.exception.message)
        with self.assertRaises(ExtractError) as caught:
            format_of({"formatVersion": 4, "kind": "forager"})
        self.assertIn("formatVersion", caught.exception.message)

    def test_base_config_is_valid(self):
        validate_forager(base())

    def test_unknown_key(self):
        config = base()
        config["surprise"] = 1
        with self.assertRaises(ExtractError) as caught:
            validate_forager(config)
        self.assertEqual(caught.exception.code, "E-CONFIG")
        self.assertIn("surprise", caught.exception.message)

    def test_c1_input_missing_from_inputs(self):
        config = base()
        del config["inputs"]["taste-right"]
        with self.assertRaises(ExtractError) as caught:
            validate_forager(config)
        self.assertEqual(caught.exception.code, "E-CONFIG")
        self.assertIn("taste-right", caught.exception.message)

    def test_c1_drive_mismatch(self):
        config = base()
        config["capabilities"]["channels"]["outputs"][4]["drive"] = "forward"
        with self.assertRaises(ExtractError) as caught:
            validate_forager(config)
        self.assertEqual(caught.exception.code, "E-CONFIG")
        self.assertIn("feed", caught.exception.message)

    def test_weight_rule_is_post_fraction(self):
        config = base()
        config["weightRule"] = "cap"
        with self.assertRaises(ExtractError) as caught:
            validate_forager(config)
        self.assertEqual(caught.exception.code, "E-CONFIG")
        self.assertIn("postFraction", caught.exception.message)

    def test_output_admission_is_fixed(self):
        config = base()
        config["outputAdmission"] = "admit-all"
        with self.assertRaises(ExtractError) as caught:
            validate_forager(config)
        self.assertEqual(caught.exception.code, "E-CONFIG")
        self.assertIn("low-confidence-sign-zero", caught.exception.message)

    def test_neuron_count_range_is_ordered(self):
        config = base()
        config["neuronCountRange"] = [6000, 2000]
        with self.assertRaises(ExtractError) as caught:
            validate_forager(config)
        self.assertEqual(caught.exception.code, "E-CONFIG")
        self.assertIn("neuronCountRange", caught.exception.message)

    def test_modulator_targets_must_be_declared_inputs(self):
        config = base()
        config["modulators"][0]["targets"] = ["feed"]
        with self.assertRaises(ExtractError) as caught:
            validate_forager(config)
        self.assertEqual(caught.exception.code, "E-MODULATOR")

    def test_modulator_gain_must_be_two_non_negative_numbers(self):
        config = base()
        config["modulators"][0]["gain"] = [-0.5, 1.5]
        with self.assertRaises(ExtractError) as caught:
            validate_forager(config)
        self.assertEqual(caught.exception.code, "E-MODULATOR")

    def test_shipped_small_config_still_dispatches_to_small(self):
        config = load_config(os.path.join(CONFIGS, "smallest-functional-brain.json"))
        self.assertEqual(format_of(config), "small")


if __name__ == "__main__":
    unittest.main()
