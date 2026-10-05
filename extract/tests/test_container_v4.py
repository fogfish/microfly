"""Brain container, version 4 (contracts/container-v4.md): round trip of a forager header built from the SYNTHETIC
fixture, each rejection message (raw bytes, so the writer's own checks do not run), the section table of version 3,
and byte identity across two writes apart from provenance.createdAt. Messages match the browser reader."""

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
from malecns_brain.__main__ import build_header_forager  # noqa: E402
from tests.test_selection_forager import admitted, edge_table, load, run  # noqa: E402

ROLE_MESSAGE = "snapshot roles out of order: expected inputs, outputs, then interneurons"


def synthetic_header(created_at="2026-01-01T00:00:00Z"):
    data = load()
    brain = run(data)
    header = build_header_forager(data["config"], brain, created_at)
    return data, brain, header


def raw_container(header, brain):
    """Encode a version 4 buffer from `header` without the writer's checks (for rejection tests)."""
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
    prefix = container.MAGIC + struct.pack("<I", 4) + struct.pack("<I", header_length)
    return prefix + encoded + bytes(body)


class ContainerV4RoundTripTest(unittest.TestCase):
    def setUp(self):
        self.data, self.brain, self.header = synthetic_header()
        self.directory = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.directory.name, "forager.brain")

    def tearDown(self):
        self.directory.cleanup()

    def write(self, path=None, header=None):
        header = header or self.header
        return write_container(path or self.path, header, self.brain["offsets"], self.brain["targets"],
                               self.brain["weights"], self.brain["synapses"])

    def read(self):
        with open(self.path, "rb") as handle:
            return read_container(handle.read())

    def test_round_trip_keeps_the_forager_header(self):
        self.write()
        result = self.read()
        self.assertEqual(result["header"]["kind"], "forager")
        self.assertEqual(result["header"]["weightRule"], "postFraction")
        self.assertEqual(result["header"]["neuronCount"], len(self.brain["neurons"]))
        self.assertEqual(result["header"]["modulators"], self.data["config"]["modulators"])
        self.assertEqual(result["header"]["neurons"][0]["channel"], "odour-left")
        self.assertTrue(np.array_equal(result["targets"], self.brain["targets"]))
        self.assertTrue(np.array_equal(result["weights"], self.brain["weights"]))

    def test_version_word_and_layout(self):
        self.write()
        with open(self.path, "rb") as handle:
            data = handle.read()
        self.assertEqual(data[:4], b"MFBR")
        self.assertEqual(struct.unpack("<I", data[4:8])[0], 4)
        self.assertEqual(len(data) % 4, 0)

    def test_section_table_matches_the_version_3_layout(self):
        table, end = container._section_table(96, 40, 17)
        self.assertEqual(table["offsets"], {"byteOffset": 108, "byteLength": 164})
        self.assertEqual(table["targets"]["byteOffset"], 272)
        synapses_end = table["synapses"]["byteOffset"] + table["synapses"]["byteLength"]
        self.assertEqual(end, (synapses_end + 3) & ~3)  # the file ends on a 4-byte boundary

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
        body_x, body_y = _body_of(x, hx), _body_of(y, hy)
        self.assertEqual(body_x, body_y)

    def rejects(self, header, message, brain=None):
        data = raw_container(header, brain or self.brain)
        with self.assertRaises(ValueError) as caught:
            read_container(data)
        self.assertEqual(str(caught.exception), message)

    def test_unknown_version_names_both_supported_versions(self):
        data = raw_container(self.header, self.brain)
        bad = data[:4] + struct.pack("<I", 5) + data[8:]
        with self.assertRaises(ValueError) as caught:
            read_container(bad)
        self.assertEqual(str(caught.exception), "unsupported snapshot version 5; this build supports 3 and 4")

    def test_unknown_kind_is_refused(self):
        bad = copy.deepcopy(self.header)
        bad["kind"] = "tank"
        self.rejects(bad, 'snapshot kind "tank" is not supported')

    def test_roles_must_follow_the_declaration(self):
        bad = copy.deepcopy(self.header)
        bad["neurons"][6]["role"] = "interneuron"
        bad["neurons"][6]["channel"] = None
        self.rejects(bad, ROLE_MESSAGE)

    def test_index_must_equal_position(self):
        bad = copy.deepcopy(self.header)
        bad["neurons"][1]["index"] = 9
        self.rejects(bad, "snapshot neuron index 9 is not its position 1")

    def test_sign_zero_only_on_outputs(self):
        bad = copy.deepcopy(self.header)
        bad["neurons"][13]["sign"] = 0
        self.rejects(bad, "snapshot neuron 13 has sign 0 but is not an output")

    def test_modulator_targets_must_be_declared_inputs(self):
        bad = copy.deepcopy(self.header)
        bad["modulators"][0]["targets"] = ["feed"]
        self.rejects(bad, "snapshot modulator hunger targets an undeclared input feed")

    def test_input_weights_must_sum_to_at_most_one(self):
        brain = dict(self.brain)
        brain["weights"] = self.brain["weights"].copy()
        brain["weights"][0] = 0.9
        brain["weights"][1] = 0.9
        self.rejects(self.header, "snapshot CSR is inconsistent: input weights into a neuron exceed 1 in absolute sum",
                     brain=brain)

    def test_writer_refuses_a_header_that_breaks_the_rules(self):
        bad = copy.deepcopy(self.header)
        bad["kind"] = "tank"
        with self.assertRaises(ValueError):
            self.write(header=bad)
        self.assertFalse(os.path.exists(self.path))


def _header_of(data):
    length = struct.unpack("<I", data[8:12])[0]
    return json.loads(data[12:12 + length].decode("utf-8"))


def _body_of(data, header):
    length = struct.unpack("<I", data[8:12])[0]
    return data[12 + length:]


if __name__ == "__main__":
    unittest.main()
