"""Format benchmark: the full admitted subgraph, written with the same container writer.

Not part of unittest (the file name does not match test*.py). Every admitted body is a neuron and
every traced-only edge between admitted bodies is kept; there is no interneuron cap. Roles come from
the reference config's selection, so sensory, LEFT and RIGHT are the first three neurons.

Usage (from extract/): MALECNS_DIR=../data/malecns .venv/bin/python tests/bench_full_admitted.py [out.brain]
"""

import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain import dataset  # noqa: E402
from malecns_brain.__main__ import build_header  # noqa: E402
from malecns_brain.config import load_config  # noqa: E402
from malecns_brain.container import read_container, write_container  # noqa: E402
from malecns_brain.selection import admit, select_brain  # noqa: E402

REFERENCE = os.path.join(HERE, "..", "configs", "smallest-functional-brain.json")
DEFAULT_OUT = os.path.join(HERE, "..", "..", "data", "snapshots", "full-admitted.brain")


def main(argv):
    directory = os.environ.get("MALECNS_DIR")
    if not directory:
        sys.exit("MALECNS_DIR is not set")
    out = os.path.normpath(argv[1] if len(argv) > 1 else DEFAULT_OUT)
    os.makedirs(os.path.dirname(out), exist_ok=True)

    config = load_config(REFERENCE)
    dataset.check_files(directory)
    bodies = admit(dataset.load_annotations(directory), dataset.load_neurotransmitters(directory), config)
    pre, post, syn = dataset.stream_edges(directory, sorted(bodies))

    # Roles from the reference selection (same rules as the extractor).
    reference = select_brain(config, bodies, (pre, post, syn))
    roles = [n["bodyId"] for n in reference["neurons"][:3]]
    rest = sorted(b for b in bodies if b not in roles)
    order = roles + rest
    ids = np.array(order, dtype=np.int64)
    index_of = np.full(max(order) + 1, -1, dtype=np.int64)
    index_of[ids] = np.arange(len(ids))

    src = index_of[pre]
    dst = index_of[post]
    keep = (src >= 0) & (dst >= 0) & (syn >= 1)
    src, dst, raw = src[keep], dst[keep], syn[keep]
    if raw.size and int(raw.max()) > 65535:
        sys.exit("E-OVERFLOW: a synapse count exceeds 65535")
    sorting = np.lexsort((dst, src))
    src, dst, raw = src[sorting], dst[sorting], raw[sorting]

    sign_of = np.array([bodies[b]["sign"] for b in order], dtype=np.float64)
    cap = config["synapseCap"]
    weights = (sign_of[src] * np.minimum(raw, cap) / cap).astype(np.float32)
    offsets = np.zeros(len(order) + 1, dtype=np.uint32)
    offsets[1:] = np.cumsum(np.bincount(src, minlength=len(order)))

    neurons = []
    for k, b in enumerate(order):
        meta = bodies[b]
        neurons.append({
            "index": k,
            "role": ("sensory", "left", "right")[k] if k < 3 else "interneuron",
            "bodyId": int(b),
            "class": meta["class"], "type": meta["type"], "somaSide": meta["somaSide"],
            "transmitter": meta["transmitter"], "transmitterConfidence": meta["transmitterConfidence"],
            "sign": meta["sign"],
        })
    brain = {"neurons": neurons, "edgeCount": int(src.size)}
    header = build_header(config, brain, "1970-01-01T00:00:00Z")

    started = time.perf_counter()
    size = write_container(out, header, offsets, dst.astype(np.uint32), weights, raw.astype(np.uint16))
    written = time.perf_counter() - started

    started = time.perf_counter()
    with open(out, "rb") as handle:
        result = read_container(handle.read())
    read = time.perf_counter() - started

    print(f"neurons        {len(order)}")
    print(f"edges          {result['edgeCount']}")
    print(f"container      {size} bytes ({size / 2**20:.1f} MiB)")
    print(f"write time     {written:.2f} s")
    print(f"read time      {read:.2f} s (read_container, including checks)")
    print(f"output         {out}")


if __name__ == "__main__":
    main(sys.argv)
