"""The command line: exit codes, output contract and the failure contract (no file on failure)."""

import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, ROOT)

from malecns_brain.container import read_container  # noqa: E402
from tests.make_fixture import write_dataset  # noqa: E402

SYNTHETIC_CONFIG = os.path.join(HERE, "fixtures", "synthetic-config.json")
FIXTURE = os.path.normpath(os.path.join(HERE, "..", "..", "tests", "fixtures", "synthetic-smallest.brain"))
ANNOTATIONS = "body-annotations-male-cns-v1.0-minconf-0.5.feather"


def read_bytes(path):
    with open(path, "rb") as handle:
        return handle.read()


def run_cli(*args, env=None):
    environment = dict(os.environ)
    environment.pop("MALECNS_DIR", None)
    environment.update(env or {})
    return subprocess.run([sys.executable, "-m", "malecns_brain", *args], cwd=ROOT,
                          capture_output=True, text=True, env=environment)


class CliTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dataset = os.path.join(self.tmp.name, "dataset")
        write_dataset(self.dataset)
        self.out = os.path.join(self.tmp.name, "out.brain")

    def test_synthetic_run_succeeds_and_self_check_is_identical(self):
        result = run_cli("extract", "--config", SYNTHETIC_CONFIG, "--dataset", self.dataset, "--out", self.out)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("self-check     identical", result.stdout)
        self.assertIn("neurons        5", result.stdout)

    def test_report_counts_positions_and_writes_position_source(self):
        result = run_cli("extract", "--config", SYNTHETIC_CONFIG, "--dataset", self.dataset, "--out", self.out)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("positions      4 with soma, 1 without", result.stdout)
        header = read_container(read_bytes(self.out))["header"]
        self.assertEqual(header["provenance"]["positionSource"],
                         "body-annotations-male-cns-v1.0-minconf-0.5.feather:somaLocation")

    def test_output_matches_the_shared_fixture_body(self):
        result = run_cli("extract", "--config", SYNTHETIC_CONFIG, "--dataset", self.dataset, "--out", self.out)
        self.assertEqual(result.returncode, 0, result.stderr)
        produced = read_container(read_bytes(self.out))
        expected = read_container(read_bytes(FIXTURE))
        for name in ("offsets", "targets", "weights", "synapses"):
            self.assertEqual(produced[name].tobytes(), expected[name].tobytes(), name)
        self.assertEqual(produced["header"]["neurons"], expected["header"]["neurons"])

    def test_missing_dataset_file_writes_nothing_and_keeps_existing_output(self):
        os.remove(os.path.join(self.dataset, ANNOTATIONS))
        with open(self.out, "wb") as handle:
            handle.write(b"previous snapshot")
        result = run_cli("extract", "--config", SYNTHETIC_CONFIG, "--dataset", self.dataset, "--out", self.out)
        self.assertEqual(result.returncode, 1)
        self.assertIn("E-DATASET-MISSING", result.stderr)
        self.assertIn(ANNOTATIONS, result.stderr)
        with open(self.out, "rb") as handle:
            self.assertEqual(handle.read(), b"previous snapshot")
        self.assertEqual(sorted(os.listdir(os.path.dirname(self.out))), sorted(["dataset", "out.brain"]))

    def test_changed_expected_row_count_fails_and_writes_nothing(self):
        with open(SYNTHETIC_CONFIG, "r", encoding="utf-8") as handle:
            config = json.load(handle)
        config["expect"]["edgeRows"] += 1
        config_path = os.path.join(self.tmp.name, "config.json")
        with open(config_path, "w", encoding="utf-8") as handle:
            json.dump(config, handle)
        result = run_cli("extract", "--config", config_path, "--dataset", self.dataset, "--out", self.out)
        self.assertEqual(result.returncode, 1)
        self.assertIn("E-DATASET-ROWS", result.stderr)
        self.assertFalse(os.path.exists(self.out))

    def test_missing_dataset_argument_is_a_usage_error(self):
        result = run_cli("extract", "--config", SYNTHETIC_CONFIG, "--out", self.out)
        self.assertEqual(result.returncode, 2)

    def test_dataset_directory_from_environment(self):
        result = run_cli("extract", "--config", SYNTHETIC_CONFIG, "--out", self.out,
                         env={"MALECNS_DIR": self.dataset})
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
