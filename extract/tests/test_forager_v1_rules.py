"""ADR 006 Gate C arm 3 ("v1 selection under D10-D12"): a format-3 forager config can opt into allTraced
admission and the minSynapses threshold, with the flow-ranked strategy itself untouched. Uses the existing
forager-synthetic fixture (tests/fixtures/forager-synthetic.json), not connectome data."""

import copy
import json
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.admission import admit_forager  # noqa: E402
from malecns_brain.config import validate_forager  # noqa: E402
from malecns_brain.errors import ExtractError  # noqa: E402
from malecns_brain.selection_forager import select_forager  # noqa: E402

FIXTURE = os.path.join(HERE, "fixtures", "forager-synthetic.json")


def load():
    with open(FIXTURE, encoding="utf-8") as handle:
        data = json.load(handle)
    config = copy.deepcopy(data["config"])
    config["admission"] = "allTraced"
    config["transmitterColumn"] = "predicted_nt"  # the fixture's transmitter rows use this column name
    config["defaultSign"] = 1
    config["transmitterSign"] = {"gaba": -1, "glutamate": -1}
    data["config"] = config
    return data


def edge_table(data):
    e = data["edges"]
    return (np.array(e["pre"], dtype=np.int64), np.array(e["post"], dtype=np.int64),
            np.array(e["synapses"], dtype=np.int64))


class ValidateAllTracedTest(unittest.TestCase):
    def test_accepts_admission_all_traced_with_the_required_keys(self):
        validate_forager(load()["config"])

    def test_rejects_an_admission_value_other_than_all_traced(self):
        config = load()["config"]
        config["admission"] = "something-else"
        with self.assertRaises(ExtractError) as ctx:
            validate_forager(config)
        self.assertEqual(ctx.exception.code, "E-CONFIG")

    def test_existing_format_3_configs_with_no_admission_key_are_unaffected(self):
        with open(os.path.join(HERE, "..", "configs", "forager-brain.json"), encoding="utf-8") as f:
            validate_forager(json.load(f))  # raises on failure; no admission/minSynapses key present


class AdmitAllTracedDispatchTest(unittest.TestCase):
    def test_body_with_unmapped_transmitter_is_admitted_with_default_sign(self):
        data = load()
        # Body 507 is Orphan (not Traced) in the fixture; 407 (MN9) has an "unclear" transmitter at low
        # confidence, which the ADR 002 rule would give sign 0 — allTraced gives it defaultSign instead.
        bodies = admit_forager(data["annotations"], data["transmitters"], data["config"], {"MN9"})
        self.assertNotIn(507, bodies)
        self.assertEqual(bodies[407]["sign"], 1)
        self.assertIn(303, bodies, "allTraced admits the sensory body the ADR 002 rule also admitted")

    def test_select_forager_runs_end_to_end_under_all_traced(self):
        data = load()
        bodies = admit_forager(data["annotations"], data["transmitters"], data["config"], {"MN9"})
        brain = select_forager(data["config"], bodies, edge_table(data))
        self.assertTrue(len(brain["neurons"]) > 0)
        for n in brain["neurons"]:
            self.assertIn(n["sign"], (-1, 1))


if __name__ == "__main__":
    unittest.main()
