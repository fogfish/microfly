"""Gate A measurements for the forager extraction (ADR 003 Gate A; T081, T082). Not a unit test.

Runs the forager config twice, each in its own process, on the MaleCNS v1.0 dataset. For each run it prints the
wall time and the peak resident memory of the child (resource usage from os.wait4), then compares the two files byte
for byte after removing provenance.createdAt. The output is the record for specs/008-hungry-forager-brain/gate-a.md.

Run from extract/:
    MALECNS_DIR=../data/malecns .venv/bin/python tests/bench_forager.py --out-dir <scratch>
"""

import argparse
import json
import os
import struct
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
CONFIG = os.path.join(ROOT, "configs", "forager-brain.json")


def peak_resident_mb(out_path, dataset, log_dir):
    """One extraction in its own process. Returns (peak resident MB, wall seconds, stdout text).

    The child's output goes to files, so os.wait4 can reap it and return its resource usage. ru_maxrss is bytes on
    macOS and kilobytes on Linux.
    """
    command = [sys.executable, "-m", "malecns_brain", "extract", "--config", CONFIG, "--out", out_path,
               "--dataset", dataset]
    stdout_path = os.path.join(log_dir, os.path.basename(out_path) + ".stdout")
    stderr_path = os.path.join(log_dir, os.path.basename(out_path) + ".stderr")
    started = time.monotonic()
    with open(stdout_path, "w", encoding="utf-8") as out, open(stderr_path, "w", encoding="utf-8") as err:
        child = subprocess.Popen(command, cwd=ROOT, stdout=out, stderr=err)
        _, status, usage = os.wait4(child.pid, 0)
    elapsed = time.monotonic() - started
    code = os.waitstatus_to_exitcode(status)
    if code != 0:
        with open(stderr_path, encoding="utf-8") as err:
            raise SystemExit(f"extraction failed ({code}): {err.read().strip()}")
    scale = 1 / (1024 * 1024) if sys.platform == "darwin" else 1 / 1024
    with open(stdout_path, encoding="utf-8") as out:
        return usage.ru_maxrss * scale, elapsed, out.read()


def without_created_at(path):
    with open(path, "rb") as handle:
        data = handle.read()
    length = struct.unpack("<I", data[8:12])[0]
    header = json.loads(data[12:12 + length])
    header["provenance"].pop("createdAt", None)
    return data[:12], header, data[12 + length:]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--dataset", default=os.environ.get("MALECNS_DIR"))
    args = parser.parse_args()
    if not args.dataset:
        parser.error("no dataset: pass --dataset or set MALECNS_DIR")
    os.makedirs(args.out_dir, exist_ok=True)

    first = os.path.join(args.out_dir, "forager-run1.brain")
    second = os.path.join(args.out_dir, "forager-run2.brain")
    mb1, s1, report = peak_resident_mb(first, args.dataset, args.out_dir)
    mb2, s2, _ = peak_resident_mb(second, args.dataset, args.out_dir)

    print(report)
    print()
    print(f"run 1  wall {s1:.1f} s, peak resident {mb1:.0f} MB")
    print(f"run 2  wall {s2:.1f} s, peak resident {mb2:.0f} MB")

    a, b = without_created_at(first), without_created_at(second)
    identical = a == b
    print(f"byte identity apart from provenance.createdAt: {'identical' if identical else 'DIFFERENT'}")
    return 0 if identical else 1


if __name__ == "__main__":
    sys.exit(main())
