"""Determinism of the forager kind (ADR 003 D6 and Gate A): two selections give the same arrays, two writes give the
same bytes apart from provenance.createdAt, and an output with an unmapped transmitter is admitted with sign 0 and no
outgoing edge (ADR 003 D2). The fixture is SYNTHETIC."""

import copy
import json
import os
import struct
import sys
import tempfile
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.__main__ import build_header_forager  # noqa: E402
from malecns_brain.admission import admit_forager  # noqa: E402
from malecns_brain.container import write_container  # noqa: E402
from malecns_brain.selection_forager import select_forager  # noqa: E402
from tests.test_selection_forager import edge_table, load  # noqa: E402


def write_once(data, path, created_at):
    config = data["config"]
    pool_types = {t for spec in config["outputs"].values() for t in spec["types"]}
    bodies = admit_forager(data["annotations"], data["transmitters"], config, pool_types)
    brain = select_forager(config, bodies, edge_table(data))
    header = build_header_forager(config, brain, created_at)
    write_container(path, header, brain["offsets"], brain["targets"], brain["weights"], brain["synapses"])


def without_created_at(data):
    length = struct.unpack("<I", data[8:12])[0]
    header = json.loads(data[12:12 + length].decode("utf-8"))
    header["provenance"].pop("createdAt")
    return data[:12], header, data[12 + length:]


class ForagerDeterminismTest(unittest.TestCase):
    def test_two_writes_differ_only_in_created_at(self):
        data = load()
        with tempfile.TemporaryDirectory() as directory:
            first = os.path.join(directory, "a.brain")
            second = os.path.join(directory, "b.brain")
            write_once(data, first, "2026-01-01T00:00:00Z")
            write_once(data, second, "2026-06-06T06:06:06Z")
            with open(first, "rb") as a, open(second, "rb") as b:
                self.assertEqual(without_created_at(a.read()), without_created_at(b.read()))

    def test_selection_is_repeatable_on_the_same_table(self):
        data = load()
        config = data["config"]
        pool_types = {t for spec in config["outputs"].values() for t in spec["types"]}
        bodies = admit_forager(data["annotations"], data["transmitters"], config, pool_types)
        one = select_forager(config, bodies, edge_table(data))
        two = select_forager(config, bodies, edge_table(data))
        for name in ("offsets", "targets", "weights", "synapses"):
            self.assertTrue(np.array_equal(one[name], two[name]), name)
        self.assertEqual(one["neurons"], two["neurons"])

    def test_output_with_unmapped_transmitter_is_admitted_with_sign_zero_and_no_outgoing_edge(self):
        data = load()
        config = data["config"]
        pool_types = {t for spec in config["outputs"].values() for t in spec["types"]}
        bodies = admit_forager(data["annotations"], data["transmitters"], config, pool_types)
        self.assertIn(407, bodies)
        self.assertEqual(bodies[407]["sign"], 0)
        brain = select_forager(config, bodies, edge_table(data))
        index = [n["bodyId"] for n in brain["neurons"]].index(407)
        self.assertEqual(brain["offsets"][index], brain["offsets"][index + 1])


if __name__ == "__main__":
    unittest.main()
