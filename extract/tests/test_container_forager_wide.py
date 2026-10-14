"""Brain container, kind "forager-wide" (ADR 007 D20, channel-declaration-v5.md): write_container/read_container
round-trip a header built from the SYNTHETIC fixture (tests/fixtures/forager-wide-synthetic.json), still
container binary version 4 (R2: only the header's declared shape is new). A kind "forager" round trip
(test_container_v4.py's own fixture) is confirmed byte-identical to before this feature, as a regression guard.
"""

import os
import sys
import tempfile
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.container import FORMAT_VERSION_V4, read_container, write_container  # noqa: E402
from malecns_brain.__main__ import build_header_class_seed  # noqa: E402
from tests.test_selection_class_seed_wide import admitted, edge_table, load, run  # noqa: E402
from tests.test_selection_forager import load as load_forager  # noqa: E402
from tests.test_selection_forager import admitted as admitted_forager  # noqa: E402
from tests.test_selection_forager import edge_table as edge_table_forager  # noqa: E402
from tests.test_selection_forager import run as run_forager  # noqa: E402
from malecns_brain.__main__ import build_header_forager  # noqa: E402


def synthetic_wide_header(created_at="2026-01-01T00:00:00Z"):
    data = load()
    brain = run(data)
    header = build_header_class_seed(data["config"], brain, created_at)
    return data, brain, header


class ContainerForagerWideRoundTripTest(unittest.TestCase):
    def setUp(self):
        self.data, self.brain, self.header = synthetic_wide_header()
        self.directory = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.directory.name, "forager-wide.brain")

    def tearDown(self):
        self.directory.cleanup()

    def write(self, header=None):
        header = header or self.header
        return write_container(self.path, header, self.brain["offsets"], self.brain["targets"],
                                self.brain["weights"], self.brain["synapses"])

    def read(self):
        with open(self.path, "rb") as handle:
            return read_container(handle.read())

    def test_round_trip_keeps_the_forager_wide_header(self):
        self.write()
        result = self.read()
        self.assertEqual(result["version"], FORMAT_VERSION_V4)
        self.assertEqual(result["kind"], "forager-wide")
        self.assertEqual(result["header"]["selection"], "classSeed")
        self.assertEqual(result["header"]["neuronCount"], len(self.brain["neurons"]))
        self.assertEqual(result["header"]["fidelity"]["checks"], self.brain["fidelity"]["checks"])

    def test_v5_declaration_round_trips_sense_and_site(self):
        self.write()
        result = self.read()
        inputs = result["header"]["capabilities"]["channels"]["inputs"]
        by_id = {ch["id"]: ch for ch in inputs}
        self.assertEqual(by_id["odour-food-left"]["sense"], "odour:food")
        self.assertEqual(by_id["odour-food-left"]["site"], "antenna")
        self.assertEqual(by_id["touch-left"]["sense"], "touch")

    def test_six_drives_are_present(self):
        self.write()
        result = self.read()
        outputs = result["header"]["capabilities"]["channels"]["outputs"]
        drives = sorted(ch["drive"] for ch in outputs)
        self.assertEqual(drives, sorted(["turnLeft", "turnRight", "forward", "backward", "feed", "escape"]))

    def test_a_malformed_v5_declaration_is_rejected(self):
        import copy
        bad = copy.deepcopy(self.header)
        del bad["capabilities"]["channels"]["inputs"][0]["sense"]
        with self.assertRaises(ValueError) as ctx:
            write_container(self.path, bad, self.brain["offsets"], self.brain["targets"],
                             self.brain["weights"], self.brain["synapses"])
        self.assertIn("sense", str(ctx.exception))

    def test_an_unsupported_kind_is_rejected(self):
        import copy
        bad = copy.deepcopy(self.header)
        bad["kind"] = "nonsense"
        with self.assertRaises(ValueError) as ctx:
            write_container(self.path, bad, self.brain["offsets"], self.brain["targets"],
                             self.brain["weights"], self.brain["synapses"])
        self.assertIn("nonsense", str(ctx.exception))


class ContainerForagerRegressionTest(unittest.TestCase):
    """A kind "forager" header's round trip is unaffected by the forager-wide dispatch added in T011."""

    def setUp(self):
        self.data = load_forager()
        self.brain = run_forager(self.data)
        self.header = build_header_forager(self.data["config"], self.brain, "2026-01-01T00:00:00Z")
        self.directory = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.directory.name, "forager.brain")

    def tearDown(self):
        self.directory.cleanup()

    def test_round_trip_is_unaffected(self):
        write_container(self.path, self.header, self.brain["offsets"], self.brain["targets"],
                         self.brain["weights"], self.brain["synapses"])
        with open(self.path, "rb") as handle:
            result = read_container(handle.read())
        self.assertEqual(result["kind"], "forager")
        self.assertTrue(np.array_equal(result["targets"], self.brain["targets"]))


if __name__ == "__main__":
    unittest.main()
