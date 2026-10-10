"""Failure codes of format 4 (ADR 006 D14, contracts/extract-config-forager-v2.md) on variants of the SYNTHETIC
fixture. Each variant breaks one rule, and the code named by the rule is raised. No file is written on a
failure: the writer is never reached."""

import copy
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.admission import admit_forager_v2  # noqa: E402
from malecns_brain.config import validate_forager_v2  # noqa: E402
from malecns_brain.errors import ExtractError  # noqa: E402
from malecns_brain.selection_forager_v2 import select_forager_v2  # noqa: E402
from tests.test_selection_forager_v2 import edge_table, load  # noqa: E402


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
        bodies = admit_forager_v2(data["annotations"], data["transmitters"], config, pool_types)
        select_forager_v2(config, bodies, edge_table(data))
    except ExtractError as error:
        return error
    return None


class ForagerV2FailureCodesTest(unittest.TestCase):
    def setUp(self):
        self.data = load()

    def test_intact_fixture_raises_nothing(self):
        self.assertIsNone(attempt(self.data))

    def test_e_pool_empty_when_a_channel_matches_no_body(self):
        def drop_heat_right(data):
            data["annotations"] = [r for r in data["annotations"] if r["bodyId"] != 2003]
        error = attempt(self.data, mutate_rows=drop_heat_right)
        self.assertEqual(error.code, "E-POOL-EMPTY")
        self.assertIn("heat-right", error.message)

    def test_e_side_imbalance_when_matching_leaves_both_sides_empty(self):
        # Relabel 1001 to a different (still-pooled) odour-food type than 2001's, so per-type matching leaves
        # neither side with a common type — both become empty after matching (as v1's own equivalent test does).
        def mismatch_types(data):
            for row in data["annotations"]:
                if row["bodyId"] == 1001:
                    row["type"] = "ORN_DM2"
        error = attempt(self.data, mutate_rows=mismatch_types)
        self.assertEqual(error.code, "E-SIDE-IMBALANCE")

    def test_e_pool_overlap_when_a_body_matches_two_channels(self):
        def widen_taste_mouth(config):
            config["inputs"]["taste-mouth-left"]["subclasses"].append("leg bristle")
        error = attempt(self.data, mutate_config=widen_taste_mouth)
        self.assertEqual(error.code, "E-POOL-OVERLAP")

    def test_e_output_unreached_when_an_output_gets_no_edge(self):
        # Drop "escape" from outputGroups first, so no (pathway, escape) pair is scored at all (no E-PAIR-EMPTY
        # risk); then cut every edge into the escape output body. The output pool itself is still declared
        # (resolve_pools reads config["outputs"], independent of outputGroups), so it must still receive an edge.
        def drop_escape_group(config):
            del config["outputGroups"]["escape"]

        def cut_escape_edges(data):
            keep = [i for i, post in enumerate(data["edges"]["post"]) if post != 3006]
            for key in ("pre", "post", "synapses"):
                data["edges"][key] = [data["edges"][key][i] for i in keep]
        error = attempt(self.data, mutate_config=drop_escape_group, mutate_edges=cut_escape_edges)
        self.assertEqual(error.code, "E-OUTPUT-UNREACHED")
        self.assertIn("escape", error.message)

    def test_e_node_range_when_the_count_is_outside_the_range(self):
        def tight_range(config):
            config["neuronCountRange"] = [100, 200]
        error = attempt(self.data, mutate_config=tight_range)
        self.assertEqual(error.code, "E-NODE-RANGE")

    def test_e_anchor_empty_when_the_anchor_matches_nothing(self):
        def drop_alln(data):
            data["annotations"] = [r for r in data["annotations"] if r["bodyId"] != 4001]
            data["transmitters"] = [r for r in data["transmitters"] if r["body"] != 4001]
            keep = [i for i in range(len(data["edges"]["pre"]))
                    if data["edges"]["pre"][i] != 4001 and data["edges"]["post"][i] != 4001]
            for key in ("pre", "post", "synapses"):
                data["edges"][key] = [data["edges"][key][i] for i in keep]
        error = attempt(self.data, mutate_rows=drop_alln)
        self.assertEqual(error.code, "E-ANCHOR-EMPTY")

    def test_e_transmitter_source_for_an_unreadable_column(self):
        config = copy.deepcopy(self.data["config"])
        config["transmitterSource"] = ["bogus_column"]
        with self.assertRaises(ExtractError) as caught:
            validate_forager_v2(config)
        self.assertEqual(caught.exception.code, "E-TRANSMITTER-SOURCE")
        self.assertIn("bogus_column", caught.exception.message)

    def test_e_transmitter_source_for_an_empty_list(self):
        config = copy.deepcopy(self.data["config"])
        config["transmitterSource"] = []
        with self.assertRaises(ExtractError) as caught:
            validate_forager_v2(config)
        self.assertEqual(caught.exception.code, "E-TRANSMITTER-SOURCE")

    def test_e_pair_empty_when_a_pair_has_no_positive_candidate(self):
        def cut_heat_mesh(data):
            keep = [i for i, pre in enumerate(data["edges"]["pre"]) if pre not in (1003, 2003)]
            for key in ("pre", "post", "synapses"):
                data["edges"][key] = [data["edges"][key][i] for i in keep]
        error = attempt(self.data, mutate_edges=cut_heat_mesh)
        self.assertEqual(error.code, "E-PAIR-EMPTY")
        self.assertIn("heat", error.message)

    def test_e_modulator_when_a_target_is_undeclared(self):
        config = copy.deepcopy(self.data["config"])
        config["modulators"][0]["targets"] = ["feed"]
        with self.assertRaises(ExtractError) as caught:
            validate_forager_v2(config)
        self.assertEqual(caught.exception.code, "E-MODULATOR")

    def test_e_config_for_an_unknown_format_pair(self):
        from malecns_brain.config import format_of
        with self.assertRaises(ExtractError) as caught:
            format_of({"formatVersion": 4, "kind": "tank"})
        self.assertEqual(caught.exception.code, "E-CONFIG")

    def test_a_failure_writes_no_file(self):
        with tempfile.TemporaryDirectory() as directory:
            out = os.path.join(directory, "forager-15k.brain")
            error = attempt(self.data, mutate_config=lambda c: c.update(neuronCountRange=[100, 200]))
            self.assertIsNotNone(error)
            self.assertEqual(os.listdir(directory), [])
            self.assertFalse(os.path.exists(out))


if __name__ == "__main__":
    unittest.main()
