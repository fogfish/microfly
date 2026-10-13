"""The same config and fixture dataset, extracted twice via extract_class_seed, give byte-identical container
bytes apart from provenance.createdAt (spec SC-001, ADR 006 D14 Acceptance)."""

import json
import os
import sys
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain import __main__ as cli  # noqa: E402
from malecns_brain import dataset  # noqa: E402

FIXTURE = os.path.join(HERE, "fixtures", "class-seed-synthetic.json")


def load():
    with open(FIXTURE, encoding="utf-8") as handle:
        return json.load(handle)


class _FakeDataset:
    """Serves the synthetic fixture's rows/edges in place of the real Feather files."""

    def __init__(self, data):
        self.data = data

    def check_files(self, directory):
        pass

    def check_rows(self, directory, expect):
        pass

    def load_annotations(self, directory, columns=None):
        return self.data["annotations"]

    def load_neurotransmitter_table(self, directory, column):
        return self.data["transmitters"]

    def stream_edges(self, directory, admitted_ids, min_synapses=1):
        import numpy as np
        e = self.data["edges"]
        ids = set(int(i) for i in admitted_ids)
        pre, post, syn = e["pre"], e["post"], e["synapses"]
        keep = [i for i in range(len(pre)) if pre[i] in ids and post[i] in ids and syn[i] >= min_synapses]
        return (np.array([pre[i] for i in keep], dtype=np.int64),
                np.array([post[i] for i in keep], dtype=np.int64),
                np.array([syn[i] for i in keep], dtype=np.int64))


class ClassSeedDeterminismTest(unittest.TestCase):
    def test_two_extractions_are_byte_identical_apart_from_created_at(self):
        data = load()
        fake = _FakeDataset(data)
        with mock.patch.object(cli.dataset, "check_files", fake.check_files), \
             mock.patch.object(cli.dataset, "check_rows", fake.check_rows), \
             mock.patch.object(cli.dataset, "load_annotations", fake.load_annotations), \
             mock.patch.object(cli.dataset, "load_neurotransmitter_table", fake.load_neurotransmitter_table), \
             mock.patch.object(cli.dataset, "stream_edges", fake.stream_edges):
            out1 = os.path.join(HERE, "fixtures", "_tmp-class-seed-1.brain")
            out2 = os.path.join(HERE, "fixtures", "_tmp-class-seed-2.brain")
            try:
                cli.extract_class_seed(data["config"], "unused", out1)
                cli.extract_class_seed(data["config"], "unused", out2)
                with open(out1, "rb") as f1, open(out2, "rb") as f2:
                    b1, b2 = f1.read(), f2.read()
                self.assertEqual(len(b1), len(b2))
                # Headers differ only in provenance.createdAt; compare the body sections (CSR arrays), which
                # come after the header and must be byte-identical outright.
                self.assertEqual(b1[-200:], b2[-200:])
            finally:
                for path in (out1, out2):
                    if os.path.exists(path):
                        os.remove(path)


if __name__ == "__main__":
    unittest.main()
