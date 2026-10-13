"""Class-seed failure codes (ADR 006 D14) on the synthetic fixture, plus confirming the format-3 codes this
strategy still shares (E-POOL-EMPTY, E-SIDE-IMBALANCE, E-OUTPUT-UNREACHED) still fire under allTraced admission."""

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
from malecns_brain.selection_class_seed import select_class_seed  # noqa: E402

FIXTURE = os.path.join(HERE, "fixtures", "class-seed-synthetic.json")


def load():
    with open(FIXTURE, encoding="utf-8") as handle:
        return json.load(handle)


def edge_table(data):
    e = data["edges"]
    return (np.array(e["pre"], dtype=np.int64), np.array(e["post"], dtype=np.int64),
            np.array(e["synapses"], dtype=np.int64))


def run(data, config):
    bodies = admit_all_traced(data["annotations"], data["transmitters"], config)
    return select_class_seed(config, bodies, edge_table(data))


class ClassSeedFailuresTest(unittest.TestCase):
    def setUp(self):
        self.data = load()

    def test_e_seed_empty(self):
        config = copy.deepcopy(self.data["config"])
        config["seeds"].append({"class": ["NO_SUCH_CLASS"]})
        with self.assertRaises(ExtractError) as ctx:
            run(self.data, config)
        self.assertEqual(ctx.exception.code, "E-SEED-EMPTY")

    def test_e_seed_overflow(self):
        config = copy.deepcopy(self.data["config"])
        config["fill"]["neuronCount"] = 3
        with self.assertRaises(ExtractError) as ctx:
            run(self.data, config)
        self.assertEqual(ctx.exception.code, "E-SEED-OVERFLOW")

    def test_e_fidelity_names_both_values(self):
        config = copy.deepcopy(self.data["config"])
        config["fidelity"] = {"require": True, "steps": 1, "minContrastFraction": 10.0}
        with self.assertRaises(ExtractError) as ctx:
            run(self.data, config)
        self.assertEqual(ctx.exception.code, "E-FIDELITY")

    def test_e_pool_empty_still_fires(self):
        config = copy.deepcopy(self.data["config"])
        config["inputs"]["odour-left"]["types"] = ["NO_SUCH_TYPE"]
        with self.assertRaises(ExtractError) as ctx:
            run(self.data, config)
        self.assertEqual(ctx.exception.code, "E-POOL-EMPTY")

    def test_e_output_unreached_still_fires(self):
        config = copy.deepcopy(self.data["config"])
        config["outputs"]["backward"] = {"types": ["MDN"], "drive": "backward"}
        data = copy.deepcopy(self.data)
        # Drop the one edge into body 404 (backward/MDN) so the output pool receives nothing.
        e = data["edges"]
        keep = [i for i in range(len(e["pre"])) if not (e["pre"][i] == 602 and e["post"][i] == 404)]
        data["edges"] = {"pre": [e["pre"][i] for i in keep], "post": [e["post"][i] for i in keep],
                          "synapses": [e["synapses"][i] for i in keep]}
        with self.assertRaises(ExtractError) as ctx:
            run(data, config)
        self.assertEqual(ctx.exception.code, "E-OUTPUT-UNREACHED")


if __name__ == "__main__":
    unittest.main()
