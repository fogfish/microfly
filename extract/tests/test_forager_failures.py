"""Failure codes of the forager kind (ADR 003 D7) on variants of the SYNTHETIC fixture. Each variant breaks one rule,
and the code named by the rule is raised. No file is written on a failure: the writer is never reached."""

import copy
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.admission import admit_forager  # noqa: E402
from malecns_brain.config import validate_forager  # noqa: E402
from malecns_brain.errors import ExtractError  # noqa: E402
from malecns_brain.selection_forager import select_forager  # noqa: E402
from tests.test_selection_forager import edge_table, load  # noqa: E402


def attempt(data, mutate_rows=None, mutate_config=None, mutate_edges=None):
    """Run admission and selection on a changed copy of the fixture; return the ExtractError raised, or None."""
    data = copy.deepcopy(data)
    if mutate_rows:
        mutate_rows(data)
    config = data["config"]
    if mutate_config:
        mutate_config(config)
    if mutate_edges:
        mutate_edges(data)
    pool_types = {t for spec in config["outputs"].values() for t in spec["types"]}
    try:
        bodies = admit_forager(data["annotations"], data["transmitters"], config, pool_types)
        select_forager(config, bodies, edge_table(data))
    except ExtractError as error:
        return error
    return None


class ForagerFailureCodesTest(unittest.TestCase):
    def setUp(self):
        self.data = load()

    def test_intact_fixture_raises_nothing(self):
        self.assertIsNone(attempt(self.data))

    def test_e_pool_empty_when_a_pool_matches_no_body(self):
        def drop_right_taste(data):
            data["annotations"] = [r for r in data["annotations"] if r["bodyId"] != 302]
        error = attempt(self.data, mutate_rows=drop_right_taste)
        self.assertEqual(error.code, "E-POOL-EMPTY")
        self.assertIn("taste-right", error.message)

    def test_e_side_imbalance_when_matching_leaves_a_side_empty(self):
        def leave_no_common_type(data):
            # Left has only ORN_DM1 (101); right has only ORN_DM2 (202). Matching per type leaves both sides empty.
            for row in data["annotations"]:
                if row["bodyId"] in (102, 103, 201):
                    row["type"] = "ORN_X"
        error = attempt(self.data, mutate_rows=leave_no_common_type)
        self.assertEqual(error.code, "E-SIDE-IMBALANCE")

    def test_e_output_unreached_when_an_output_gets_no_edge(self):
        def cut_feed(data):
            keep = [i for i, post in enumerate(data["edges"]["post"]) if post != 407]
            for key in ("pre", "post", "synapses"):
                data["edges"][key] = [data["edges"][key][i] for i in keep]
        error = attempt(self.data, mutate_edges=cut_feed)
        self.assertEqual(error.code, "E-OUTPUT-UNREACHED")
        self.assertIn("feed", error.message)

    def test_e_node_range_when_the_count_is_outside_the_range(self):
        def tight_range(config):
            config["neuronCountRange"] = [100, 200]
        error = attempt(self.data, mutate_config=tight_range)
        self.assertEqual(error.code, "E-NODE-RANGE")

    def test_e_modulator_when_a_target_is_undeclared(self):
        config = copy.deepcopy(self.data["config"])
        config["modulators"][0]["targets"] = ["feed"]
        with self.assertRaises(ExtractError) as caught:
            validate_forager(config)
        self.assertEqual(caught.exception.code, "E-MODULATOR")

    def test_e_config_for_an_unknown_format_pair(self):
        from malecns_brain.config import format_of
        with self.assertRaises(ExtractError) as caught:
            format_of({"formatVersion": 3, "kind": "tank"})
        self.assertEqual(caught.exception.code, "E-CONFIG")

    def test_a_failure_writes_no_file(self):
        with tempfile.TemporaryDirectory() as directory:
            out = os.path.join(directory, "forager.brain")
            error = attempt(self.data, mutate_config=lambda c: c.update(neuronCountRange=[100, 200]))
            self.assertIsNotNone(error)
            self.assertEqual(os.listdir(directory), [])
            self.assertFalse(os.path.exists(out))


if __name__ == "__main__":
    unittest.main()
