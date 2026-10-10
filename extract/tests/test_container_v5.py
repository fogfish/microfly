"""Brain container, version 5 (contracts/container-v5.md): round trip of a v5 header built from the SYNTHETIC
fixture, each _check_forager_v2 invariant (one test per violation), and byte identity across two writes apart
from provenance.createdAt. Messages match the browser reader (public/js/brain/snapshot.js)."""

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

from malecns_brain import container  # noqa: E402
from malecns_brain.container import read_container, write_container  # noqa: E402
from malecns_brain.__main__ import build_header_forager_v2  # noqa: E402
from tests.test_selection_forager_v2 import admitted, edge_table, load, run  # noqa: E402


def synthetic_header(created_at="2026-01-01T00:00:00Z"):
    data = load()
    brain = run(data)
    header = build_header_forager_v2(data["config"], brain, created_at)
    return data, brain, header


def raw_container(header, brain):
    """Encode a version 5 buffer from `header` without the writer's checks (for rejection tests)."""
    neuron_count = len(header["neurons"])
    edge_count = int(brain["edgeCount"])
    header_length = 0
    for _ in range(4):
        table, _ = container._section_table(header_length, neuron_count, edge_count)
        header_length = container._pad8(len(container._encode_header(dict(header, sections=table))))
    table, end = container._section_table(header_length, neuron_count, edge_count)
    encoded = container._encode_header(dict(header, sections=table))
    encoded += b" " * (header_length - len(encoded))
    body = bytearray()
    body += brain["offsets"].astype("<u4").tobytes()
    body += brain["targets"].astype("<u4").tobytes()
    body += brain["weights"].astype("<f4").tobytes()
    body += brain["synapses"].astype("<u2").tobytes()
    body += b"\x00" * (end - container.PREFIX - header_length - len(body))
    prefix = container.MAGIC + struct.pack("<I", 5) + struct.pack("<I", header_length)
    return prefix + encoded + bytes(body)


class ContainerV5RoundTripTest(unittest.TestCase):
    def setUp(self):
        self.data, self.brain, self.header = synthetic_header()
        self.directory = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.directory.name, "forager-15k.brain")

    def tearDown(self):
        self.directory.cleanup()

    def write(self, path=None, header=None):
        header = header or self.header
        return write_container(path or self.path, header, self.brain["offsets"], self.brain["targets"],
                               self.brain["weights"], self.brain["synapses"])

    def read(self):
        with open(self.path, "rb") as handle:
            return read_container(handle.read())

    def test_round_trip_keeps_the_v5_header(self):
        self.write()
        result = self.read()
        self.assertEqual(result["version"], 5)
        self.assertEqual(result["header"]["kind"], "forager")
        self.assertEqual(result["header"]["weightRule"], "synapseCount")
        self.assertEqual(result["header"]["minSynapses"], 1)
        self.assertEqual(result["header"]["neuronCount"], len(self.brain["neurons"]))
        self.assertEqual(result["header"]["neurons"][0]["channel"], "odour-food-left")
        self.assertEqual(result["header"]["neurons"][0]["group"], "input")
        self.assertIn(result["header"]["neurons"][0]["transmitterSource"],
                      ("ground_truth", "consensus_nt", "predicted_nt"))
        self.assertTrue(np.array_equal(result["targets"], self.brain["targets"]))
        self.assertTrue(np.array_equal(result["weights"], self.brain["weights"]))

    def test_version_word(self):
        self.write()
        with open(self.path, "rb") as handle:
            data = handle.read()
        self.assertEqual(data[:4], b"MFBR")
        self.assertEqual(struct.unpack("<I", data[4:8])[0], 5)

    def test_unknown_version_names_all_three_supported_versions(self):
        data = raw_container(self.header, self.brain)
        bad = data[:4] + struct.pack("<I", 7) + data[8:]
        with self.assertRaises(ValueError) as caught:
            read_container(bad)
        self.assertEqual(str(caught.exception), "unsupported snapshot version 7; this build supports 3, 4 and 5")

    def test_two_writes_are_identical_apart_from_created_at(self):
        first = os.path.join(self.directory.name, "a.brain")
        second = os.path.join(self.directory.name, "b.brain")
        self.write(first)
        _, _, later = synthetic_header(created_at="2026-02-02T02:02:02Z")
        self.write(second, header=later)
        with open(first, "rb") as a, open(second, "rb") as b:
            x, y = a.read(), b.read()
        self.assertEqual(len(x), len(y))
        hx, hy = _header_of(x), _header_of(y)
        hx["provenance"].pop("createdAt")
        hy["provenance"].pop("createdAt")
        self.assertEqual(hx, hy)

    def rejects(self, header, message, brain=None):
        data = raw_container(header, brain or self.brain)
        with self.assertRaises(ValueError) as caught:
            read_container(data)
        self.assertEqual(str(caught.exception), message)

    def test_weight_rule_must_be_one_of_three_values(self):
        bad = copy.deepcopy(self.header)
        bad["weightRule"] = "cap"
        self.rejects(bad, 'snapshot weight rule "cap" is not supported')

    def test_every_input_channel_needs_a_sense(self):
        bad = copy.deepcopy(self.header)
        bad["capabilities"]["channels"]["inputs"][0].pop("sense")
        self.rejects(bad, "snapshot channel odour-food-left is malformed: sense")

    def test_every_input_channel_needs_a_site(self):
        bad = copy.deepcopy(self.header)
        bad["capabilities"]["channels"]["inputs"][0]["site"] = "nowhere"
        self.rejects(bad, "snapshot channel odour-food-left is malformed: site")

    def test_escape_drive_must_appear_exactly_once(self):
        bad = copy.deepcopy(self.header)
        bad["capabilities"]["channels"]["outputs"][5]["drive"] = "forward"
        self.rejects(bad, "snapshot outputs must have exactly one of each forager drive")

    def test_every_neuron_group_must_be_one_of_six_regions(self):
        bad = copy.deepcopy(self.header)
        bad["neurons"][-1]["group"] = "bogus"
        self.rejects(bad, f"snapshot neuron {len(bad['neurons']) - 1} has an unknown group bogus")

    def test_every_neuron_transmitter_source_must_be_one_of_three_columns(self):
        bad = copy.deepcopy(self.header)
        bad["neurons"][-1]["transmitterSource"] = "bogus"
        self.rejects(bad, f"snapshot neuron {len(bad['neurons']) - 1} has an unknown transmitterSource bogus")

    def test_synapse_count_weights_are_not_checked_for_inflow_sum(self):
        # weightRule synapseCount: weights are sign*synapses, not normalised, so they may exceed 1 freely.
        brain = dict(self.brain)
        brain["weights"] = self.brain["weights"].copy()
        brain["weights"][0] = 50.0
        self.write(header=self.header)  # the normal write (unmutated) must still succeed
        data = raw_container(self.header, brain)
        read_container(data)  # must not raise despite a weight of 50

    def test_writer_refuses_a_header_that_breaks_the_rules(self):
        bad = copy.deepcopy(self.header)
        bad["kind"] = "tank"
        with self.assertRaises(ValueError):
            self.write(header=bad)
        self.assertFalse(os.path.exists(self.path))


def _header_of(data):
    length = struct.unpack("<I", data[8:12])[0]
    return json.loads(data[12:12 + length].decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
