"""Container contract, Python side (snapshot-format.md). Same fixture and messages as tests/snapshot.test.mjs."""

import json
import os
import struct
import sys
import tempfile
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.container import read_container, write_container  # noqa: E402

FIXTURE = os.path.normpath(os.path.join(HERE, "..", "..", "tests", "fixtures", "synthetic-smallest.brain"))


def header_for(neurons, edge_count):
    return {
        "provenance": {
            "datasetRelease": "unit-test", "edgeVariant": "traced-only", "minConfidence": 0.5,
            "configHash": "sha256:test", "toolVersion": "0.1.0", "createdAt": "1970-01-01T00:00:00Z",
        },
        "synapseCap": 5,
        "neuronCount": len(neurons),
        "edgeCount": edge_count,
        "neurons": neurons,
    }


def neuron(index, role):
    return {"index": index, "role": role, "bodyId": 1000 + index, "class": None, "type": None,
            "somaSide": None, "transmitter": "acetylcholine", "transmitterConfidence": 0.9, "sign": 1}


def small_container(path):
    neurons = [neuron(0, "sensory"), neuron(1, "left"), neuron(2, "right"), neuron(3, "interneuron")]
    offsets = [0, 2, 2, 2, 2]
    targets = [3, 1]
    weights = [1.0, -0.2]
    synapses = [5, 1]
    write_container(path, header_for(neurons, 2), offsets, targets, weights, synapses)


def read_bytes(path):
    with open(path, "rb") as handle:
        return handle.read()


def rebuild(data, mutate):
    """Decode a container, let `mutate` change the header dict, and write it back with fresh sections."""
    result = read_container(data)
    header = {k: v for k, v in result["header"].items() if k != "sections"}
    mutate(header)
    with tempfile.TemporaryDirectory() as directory:
        path = os.path.join(directory, "rebuilt.brain")
        write_container(path, header, result["offsets"], result["targets"], result["weights"], result["synapses"])
        return read_bytes(path)


class ContainerTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.directory.name, "small.brain")
        small_container(self.path)
        self.data = read_bytes(self.path)

    def tearDown(self):
        self.directory.cleanup()

    def assertRejects(self, data, message):
        with self.assertRaises(ValueError) as caught:
            read_container(data)
        self.assertEqual(str(caught.exception), message)

    def test_round_trip(self):
        result = read_container(self.data)
        self.assertEqual(result["neuronCount"], 4)
        self.assertEqual(result["edgeCount"], 2)
        self.assertEqual(list(result["offsets"]), [0, 2, 2, 2, 2])
        self.assertEqual(list(result["targets"]), [3, 1])
        self.assertEqual(list(result["synapses"]), [5, 1])
        self.assertTrue(np.allclose(result["weights"], [1.0, -0.2]))

    def test_two_writes_are_byte_identical(self):
        second = os.path.join(self.directory.name, "second.brain")
        small_container(second)
        self.assertEqual(read_bytes(second), self.data)

    def test_layout_prefix(self):
        self.assertEqual(self.data[:4], b"MFBR")
        self.assertEqual(struct.unpack("<I", self.data[4:8])[0], 2)
        header_length = struct.unpack("<I", self.data[8:12])[0]
        self.assertEqual(header_length % 8, 0)
        self.assertEqual(len(self.data) % 4, 0)

    def test_rejects_bad_magic(self):
        bad = b"XXXX" + self.data[4:]
        self.assertRejects(bad, "not a brain snapshot")

    def test_rejects_short_file(self):
        self.assertRejects(self.data[:8], "not a brain snapshot")

    def test_rejects_version_3(self):
        bad = self.data[:4] + struct.pack("<I", 3) + self.data[8:]
        self.assertRejects(bad, "unsupported snapshot version 3; this build supports 2")

    def test_rejects_truncated_header(self):
        bad = self.data[:8] + struct.pack("<I", 100000 & ~7) + self.data[12:]
        self.assertRejects(bad, "snapshot header is truncated")

    def test_rejects_roles_out_of_order(self):
        def swap(header):
            header["neurons"][1]["role"], header["neurons"][2]["role"] = "right", "left"
        self.assertRejects(rebuild(self.data, swap), "snapshot roles out of order: expected sensory, left, right")

    def test_rejects_section_out_of_bounds(self):
        header_length = struct.unpack("<I", self.data[8:12])[0]
        import json as _json
        header = _json.loads(self.data[12:12 + header_length].decode("utf-8"))
        header["sections"]["targets"]["byteLength"] += 1  # one digit, so the header keeps its length
        encoded = _json.dumps(header, sort_keys=True, separators=(",", ":")).encode("utf-8")
        encoded += b" " * (header_length - len(encoded))
        bad = self.data[:12] + encoded + self.data[12 + header_length:]
        self.assertRejects(bad, "snapshot section targets is out of bounds")

    def test_rejects_non_monotone_offsets(self):
        bad = bytearray(self.data)
        offsets_at = self.section_offset("offsets")
        struct.pack_into("<I", bad, offsets_at + 4, 3)
        self.assertRaisesRegex(ValueError, r"^snapshot CSR is inconsistent: ", read_container, bytes(bad))

    def test_rejects_target_outside_neuron_count(self):
        bad = bytearray(self.data)
        struct.pack_into("<I", bad, self.section_offset("targets"), 4)
        self.assertRejects(bytes(bad), "snapshot CSR is inconsistent: a target is outside neuronCount")

    def test_rejects_synapse_count_zero(self):
        bad = bytearray(self.data)
        struct.pack_into("<H", bad, self.section_offset("synapses"), 0)
        self.assertRejects(bytes(bad), "snapshot CSR is inconsistent: a synapse count is 0")

    def test_round_trip_of_position_and_superclass(self):
        def add_fields(header):
            header["neurons"][0].update(soma=[1, 2, 3], superclass="ascending_neuron")
            header["neurons"][3].update(soma=None, superclass=None)
        result = read_container(rebuild(self.data, add_fields))
        self.assertEqual(result["header"]["neurons"][0]["soma"], [1, 2, 3])
        self.assertEqual(result["header"]["neurons"][0]["superclass"], "ascending_neuron")
        self.assertIsNone(result["header"]["neurons"][3]["soma"])

    def test_header_without_position_or_superclass_is_accepted(self):
        self.assertNotIn("soma", read_container(self.data)["header"]["neurons"][0])
        self.assertEqual(read_container(self.data)["neuronCount"], 4)

    def test_rejects_malformed_soma(self):
        def bad_soma(header):
            header["neurons"][3]["soma"] = [1, 2]
        self.assertRejects(rebuild(self.data, bad_soma), "snapshot neuron 3 has a malformed soma position")

    def test_rejects_soma_with_bool_component(self):
        def bad_soma(header):
            header["neurons"][1]["soma"] = [True, 2, 3]
        self.assertRejects(rebuild(self.data, bad_soma), "snapshot neuron 1 has a malformed soma position")

    def test_rejects_malformed_superclass(self):
        def bad_superclass(header):
            header["neurons"][3]["superclass"] = 5
        self.assertRejects(rebuild(self.data, bad_superclass), "snapshot neuron 3 has a malformed superclass")

    def section_offset(self, name):
        header_length = struct.unpack("<I", self.data[8:12])[0]
        header = json.loads(self.data[12:12 + header_length].decode("utf-8"))
        return header["sections"][name]["byteOffset"]

    def test_contract_read_back_of_shared_fixture(self):
        result = read_container(read_bytes(FIXTURE))
        self.assertEqual(result["neuronCount"], 5)
        self.assertEqual(result["edgeCount"], 4)
        self.assertEqual(list(result["targets"]), [3, 4, 2, 1])
        self.assertEqual(result["header"]["neurons"][0]["role"], "sensory")


if __name__ == "__main__":
    unittest.main()
