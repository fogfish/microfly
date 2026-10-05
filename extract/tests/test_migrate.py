"""Header-only migration, version 2 → version 3 (specs/006-fly-status-panel/contracts/snapshot-format-v3.md)."""

import json
import os
import struct
import sys
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.config import load_config  # noqa: E402
from malecns_brain.container import read_container, write_container  # noqa: E402
from malecns_brain.errors import ExtractError  # noqa: E402
from malecns_brain.migrate import migrate  # noqa: E402

from tests.test_container import CAPABILITIES, header_for, neuron, read_bytes  # noqa: E402

CONFIG = os.path.join(HERE, "fixtures", "synthetic-config.json")
BODY = ("offsets", "targets", "weights", "synapses")


def v3_container(path):
    neurons = [neuron(0, "sensory"), neuron(1, "left"), neuron(2, "right"), neuron(3, "interneuron")]
    write_container(path, header_for(neurons, 2), [0, 2, 2, 2, 2], [3, 1], [1.0, -0.2], [5, 1])


def to_legacy(data):
    """A version 2 file with the same body: no capabilities block, version field 2."""
    result = read_container(data)
    header = {k: v for k, v in result["header"].items() if k not in ("sections", "capabilities")}
    with tempfile.TemporaryDirectory() as directory:
        path = os.path.join(directory, "legacy.brain")
        with mock.patch("malecns_brain.container.validate_capabilities"):
            write_container(path, header, result["offsets"], result["targets"], result["weights"], result["synapses"])
        raw = bytearray(read_bytes(path))
    struct.pack_into("<I", raw, 4, 2)
    return bytes(raw)


def body_bytes(data):
    result = read_container(data, version=struct.unpack("<I", data[4:8])[0])
    return {name: result[name].tobytes() for name in BODY}


def header_json(data):
    length = struct.unpack("<I", data[8:12])[0]
    return json.loads(data[12:12 + length].decode("utf-8"))


class MigrateTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.dir = self.directory.name
        v3_path = os.path.join(self.dir, "v3.brain")
        v3_container(v3_path)
        self.v3 = read_bytes(v3_path)
        self.legacy_path = os.path.join(self.dir, "legacy.brain")
        with open(self.legacy_path, "wb") as handle:
            handle.write(to_legacy(self.v3))
        self.out = os.path.join(self.dir, "migrated.brain")

    def tearDown(self):
        self.directory.cleanup()

    def test_legacy_fixture_is_version_two(self):
        self.assertEqual(struct.unpack("<I", read_bytes(self.legacy_path)[4:8])[0], 2)

    def test_body_bytes_are_unchanged(self):
        migrate(self.legacy_path, CONFIG, self.out)
        self.assertEqual(body_bytes(read_bytes(self.out)), body_bytes(read_bytes(self.legacy_path)))

    def test_header_differs_only_in_capabilities_and_sections(self):
        migrate(self.legacy_path, CONFIG, self.out)
        before = header_json(read_bytes(self.legacy_path))
        after = header_json(read_bytes(self.out))
        changed = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
        self.assertEqual(changed, ["capabilities", "sections"])

    def test_migrated_file_is_version_three_with_the_config_capabilities(self):
        migrate(self.legacy_path, CONFIG, self.out)
        data = read_bytes(self.out)
        self.assertEqual(struct.unpack("<I", data[4:8])[0], 3)
        self.assertEqual(read_container(data)["header"]["capabilities"], load_config(CONFIG)["capabilities"])
        self.assertEqual(load_config(CONFIG)["capabilities"], CAPABILITIES)

    def test_migrated_file_equals_the_fresh_v3_container_in_body(self):
        migrate(self.legacy_path, CONFIG, self.out)
        self.assertEqual(body_bytes(read_bytes(self.out)), body_bytes(self.v3))

    def test_a_version_three_input_is_refused(self):
        with self.assertRaises(ExtractError) as caught:
            migrate(os.path.join(self.dir, "v3.brain"), CONFIG, self.out)
        self.assertEqual(caught.exception.code, "E-MIGRATE")
        self.assertIn("unsupported snapshot version 3; this build supports 2", str(caught.exception))

    def test_in_place_migration_keeps_the_body(self):
        migrate(self.legacy_path, CONFIG, self.legacy_path)
        self.assertEqual(body_bytes(read_bytes(self.legacy_path)), body_bytes(self.v3))


if __name__ == "__main__":
    unittest.main()
