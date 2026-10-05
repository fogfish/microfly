"""The small brain (ADR 002, container version 3) is unchanged by the forager work (spec SC-002). Runs the small config
on the real dataset when MALECNS_DIR is set (skipped otherwise), and compares the output with the committed
public/brains/smallest-functional-brain.brain.

The comparison ignores provenance.createdAt, and provenance.configHash. The committed file's configHash comes from an
earlier state of the config; the HEAD code gives a different hash for the same config today. That predates the forager
work and is recorded in specs/008-hungry-forager-brain/gate-a.md. Every other byte and header field must match.
"""

import json
import os
import struct
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.__main__ import extract  # noqa: E402

COMMITTED = os.path.join(ROOT, "public", "brains", "smallest-functional-brain.brain")
CONFIG = os.path.join(ROOT, "extract", "configs", "smallest-functional-brain.json")
DATASET = os.environ.get("MALECNS_DIR")


def split(path):
    with open(path, "rb") as handle:
        data = handle.read()
    length = struct.unpack("<I", data[8:12])[0]
    header = json.loads(data[12:12 + length].decode("utf-8"))
    header["provenance"].pop("createdAt", None)
    header["provenance"].pop("configHash", None)
    return data[4:8], header, data[12 + length:]


@unittest.skipUnless(DATASET, "MALECNS_DIR is not set; the real dataset is needed")
class SmallBrainUnchangedTest(unittest.TestCase):
    def test_small_config_reproduces_the_committed_brain(self):
        with tempfile.TemporaryDirectory() as directory:
            out = os.path.join(directory, "small.brain")
            extract(CONFIG, DATASET, out)
            self.assertEqual(split(out), split(COMMITTED))


if __name__ == "__main__":
    unittest.main()
