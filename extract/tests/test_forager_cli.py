"""The forager kind end to end through the CLI entry point (extract()), on Feather files written from the SYNTHETIC
fixture. The config's expect counts are set to the fixture's row counts, so the dataset check runs for real.
Covers the dispatch to container version 4, the report, and the v4 header read back (tests/test_cli.py covers v3)."""

import json
import os
import sys
import tempfile
import unittest

import pyarrow as pa
from pyarrow import feather

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.__main__ import extract  # noqa: E402
from malecns_brain.container import read_container  # noqa: E402
from tests.test_selection_forager import load  # noqa: E402

ANNOTATIONS = "body-annotations-male-cns-v1.0-minconf-0.5.feather"
NEUROTRANSMITTERS = "body-neurotransmitters-male-cns-v1.0.feather"
EDGES = "connectome-weights-male-cns-v1.0-minconf-0.5-traced-only.feather"


def read_container_file(path):
    with open(path, "rb") as handle:
        return read_container(handle.read())


def write_dataset(data, directory):
    rows = data["annotations"]
    feather.write_feather(pa.table({
        "bodyId": [r["bodyId"] for r in rows],
        "class": [r["class"] for r in rows],
        "superclass": [r["superclass"] for r in rows],
        "somaSide": [r["somaSide"] for r in rows],
        "somaLocation": pa.array([r["somaLocation"] for r in rows], type=pa.list_(pa.int64())),
        "status": [r["status"] for r in rows],
        "type": [r["type"] for r in rows],
        "rootSide": [r["rootSide"] for r in rows],
        "subclass": [r["subclass"] for r in rows],
        "receptorType": [r["receptorType"] for r in rows],
    }), os.path.join(directory, ANNOTATIONS))
    feather.write_feather(pa.table({
        "body": [r["body"] for r in data["transmitters"]],
        "predicted_nt": [r["predicted_nt"] for r in data["transmitters"]],
        "predicted_nt_confidence": [r["predicted_nt_confidence"] for r in data["transmitters"]],
    }), os.path.join(directory, NEUROTRANSMITTERS))
    edges = data["edges"]
    feather.write_feather(pa.table({
        "body_pre": edges["pre"], "body_post": edges["post"], "weight": edges["synapses"],
    }), os.path.join(directory, EDGES))


class ForagerCliTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.data = load()
        self.dataset = os.path.join(self.directory.name, "dataset")
        os.makedirs(self.dataset)
        write_dataset(self.data, self.dataset)
        config = json.loads(json.dumps(self.data["config"]))
        config["expect"] = {
            "annotationRows": len(self.data["annotations"]),
            "edgeRows": len(self.data["edges"]["pre"]),
            "neurotransmitterRows": len(self.data["transmitters"]),
        }
        self.config = os.path.join(self.directory.name, "forager.json")
        with open(self.config, "w", encoding="utf-8") as handle:
            json.dump(config, handle)
        self.out = os.path.join(self.directory.name, "forager.brain")

    def tearDown(self):
        self.directory.cleanup()

    def test_forager_config_writes_version_4_and_reports_each_pool(self):
        report = extract(self.config, self.dataset, self.out)
        result = read_container_file(self.out)
        self.assertEqual(result["version"], 4)
        self.assertEqual(result["kind"], "forager")
        self.assertIn("pools:", report)
        self.assertIn("side balance   odour: left", report)
        self.assertIn("feed (MN9) edges", report)
        self.assertIn("self-check     identical", report)

    def test_the_header_names_each_pool_by_neuron_index(self):
        extract(self.config, self.dataset, self.out)
        header = read_container_file(self.out)["header"]
        channels = {c["id"]: c["neurons"] for c in header["capabilities"]["channels"]["inputs"]
                    + header["capabilities"]["channels"]["outputs"]}
        self.assertEqual(channels["odour-left"], [0, 1])
        self.assertEqual(channels["feed"], [12])


if __name__ == "__main__":
    unittest.main()
