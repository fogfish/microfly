"""The v1 forager brain (ADR 003, container version 4) is unchanged by the ADR 006 (15K, format 4) work (spec
SC-002, SC-004). Runs the forager-brain.json config on the real dataset when MALECNS_DIR is set (skipped
otherwise), and compares the output with the committed public/brains/forager-brain.brain.

The comparison ignores provenance.createdAt. Every other byte and header field must match, including
provenance.configHash (format 3's config has not changed).
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

COMMITTED = os.path.join(ROOT, "public", "brains", "forager-brain.brain")
CONFIG = os.path.join(ROOT, "extract", "configs", "forager-brain.json")
DATASET = os.environ.get("MALECNS_DIR")


def split(path):
    with open(path, "rb") as handle:
        data = handle.read()
    length = struct.unpack("<I", data[8:12])[0]
    header = json.loads(data[12:12 + length].decode("utf-8"))
    header["provenance"].pop("createdAt", None)
    return data[4:8], header, data[12 + length:]


@unittest.skipUnless(DATASET, "MALECNS_DIR is not set; the real dataset is needed")
class ForagerV1UnchangedTest(unittest.TestCase):
    def test_forager_v1_config_reproduces_the_committed_brain(self):
        with tempfile.TemporaryDirectory() as directory:
            out = os.path.join(directory, "forager.brain")
            extract(CONFIG, DATASET, out)
            self.assertEqual(split(out), split(COMMITTED))


if __name__ == "__main__":
    unittest.main()
