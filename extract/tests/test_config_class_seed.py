"""Config validation for selection:"classSeed" (contracts/extract-config-classseed.md, ADR 006 D14)."""

import copy
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import pyarrow as pa  # noqa: E402
from pyarrow import ipc  # noqa: E402

from malecns_brain import dataset  # noqa: E402
from malecns_brain.config import validate_class_seed  # noqa: E402
from malecns_brain.errors import ExtractError  # noqa: E402

CONFIG_PATH = os.path.join(HERE, "..", "configs", "forager-brain-11k.json")


def shipped_config():
    with open(CONFIG_PATH, encoding="utf-8") as handle:
        return json.load(handle)


class ValidateClassSeedTest(unittest.TestCase):
    def test_accepts_the_shipped_config_shape(self):
        validate_class_seed(shipped_config())  # raises on failure

    def test_rejects_each_flow_strategy_only_key(self):
        for key, value in (("pathways", {}), ("flowSteps", 5), ("budget", {"odour": 1, "taste": 1}),
                            ("outputAdmission", "low-confidence-sign-zero"), ("minConfidence", 0.5)):
            config = copy.deepcopy(shipped_config())
            config[key] = value
            with self.assertRaises(ExtractError) as ctx:
                validate_class_seed(config)
            self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_rejects_wrong_format_version(self):
        config = copy.deepcopy(shipped_config())
        config["formatVersion"] = 3
        with self.assertRaises(ExtractError) as ctx:
            validate_class_seed(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_rejects_malformed_seed_filter(self):
        config = copy.deepcopy(shipped_config())
        config["seeds"][0] = {"class": ["X"], "superclass": ["Y"]}
        with self.assertRaises(ExtractError) as ctx:
            validate_class_seed(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_rejects_missing_fill_key(self):
        config = copy.deepcopy(shipped_config())
        del config["fill"]["excludeClasses"]
        with self.assertRaises(ExtractError) as ctx:
            validate_class_seed(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")


class TransmitterColumnTest(unittest.TestCase):
    """E-TRANSMITTER-COLUMN (dataset.load_neurotransmitter_table): the column name is config, checked against
    the dataset's actual schema, not a fixed extractor requirement."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        table = pa.table({"body": pa.array([1, 2], type=pa.int64()),
                           "consensus_nt": pa.array(["acetylcholine", "gaba"])})
        path = os.path.join(self.tmp, dataset.NEUROTRANSMITTERS)
        with pa.OSFile(path, "wb") as sink:
            with ipc.new_file(sink, table.schema) as writer:
                writer.write_table(table)

    def test_known_column_loads(self):
        rows = dataset.load_neurotransmitter_table(self.tmp, "consensus_nt")
        self.assertEqual({r["body"] for r in rows}, {1, 2})

    def test_unknown_column_raises_e_transmitter_column(self):
        with self.assertRaises(ExtractError) as ctx:
            dataset.load_neurotransmitter_table(self.tmp, "no_such_column")
        self.assertEqual(ctx.exception.code, "E-TRANSMITTER-COLUMN")


if __name__ == "__main__":
    unittest.main()
