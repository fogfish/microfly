"""format_of dispatch table (contracts/extract-config-classseed.md "Dispatch"): formatVersion/kind/selection
resolve to small/forager/classSeed, and any other combination is E-CONFIG naming the offending key."""

import copy
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.config import format_of  # noqa: E402
from malecns_brain.errors import ExtractError  # noqa: E402


def small():
    with open(os.path.join(HERE, "..", "configs", "smallest-functional-brain.json"), encoding="utf-8") as f:
        return json.load(f)


def forager():
    with open(os.path.join(HERE, "..", "configs", "forager-brain.json"), encoding="utf-8") as f:
        return json.load(f)


def class_seed():
    with open(os.path.join(HERE, "..", "configs", "forager-brain-11k.json"), encoding="utf-8") as f:
        return json.load(f)


class FormatOfDispatchTest(unittest.TestCase):
    def test_2_absent_dash_is_small(self):
        self.assertEqual(format_of(small()), "small")

    def test_3_forager_absent_is_forager(self):
        self.assertEqual(format_of(forager()), "forager")

    def test_4_forager_classseed_is_classseed(self):
        self.assertEqual(format_of(class_seed()), "classSeed")

    def test_other_combinations_raise_e_config(self):
        cases = []

        bad = copy.deepcopy(small())
        bad["kind"] = "forager"
        cases.append(bad)

        bad = copy.deepcopy(forager())
        bad["selection"] = "classSeed"
        cases.append(bad)

        bad = copy.deepcopy(class_seed())
        del bad["selection"]
        cases.append(bad)

        bad = copy.deepcopy(class_seed())
        bad["kind"] = "tank"
        cases.append(bad)

        bad = {"formatVersion": 5}
        cases.append(bad)

        for config in cases:
            with self.assertRaises(ExtractError) as ctx:
                format_of(config)
            self.assertEqual(ctx.exception.code, "E-CONFIG")


if __name__ == "__main__":
    unittest.main()
