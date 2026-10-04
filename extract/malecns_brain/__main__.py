"""Command line: python -m malecns_brain extract --config <file> [--dataset <dir>] --out <file.brain>

Exit status: 0 written and self-check identical; 1 an ExtractError (no file written); 2 usage.
"""

import argparse
import os
import sys
from datetime import datetime, timezone

from . import __version__
from . import dataset
from .config import config_hash, load_config
from .container import write_container
from .errors import ExtractError
from .selection import admit, select_brain


def build_header(config, brain, created_at):
    """The container header (snapshot-format.md) for a selected brain."""
    return {
        "provenance": {
            "datasetRelease": config["datasetRelease"],
            "edgeVariant": config["edgeVariant"],
            "minConfidence": config["minConfidence"],
            "configHash": config_hash(config),
            "toolVersion": __version__,
            "createdAt": created_at,
        },
        "synapseCap": config["synapseCap"],
        "neuronCount": len(brain["neurons"]),
        "edgeCount": brain["edgeCount"],
        "neurons": brain["neurons"],
    }


def _same_body(first, second):
    return all(first[name].tobytes() == second[name].tobytes()
               for name in ("offsets", "targets", "weights", "synapses"))


def _same_header(first, second):
    def without_time(header):
        return {k: v for k, v in header.items() if k != "provenance"} | {
            "provenance": {k: v for k, v in header["provenance"].items() if k != "createdAt"}}
    return without_time(first) == without_time(second)


def report(config, brain, output, size, self_check):
    neurons = brain["neurons"]
    counts = {}
    for n in neurons:
        counts[n["transmitter"]] = counts.get(n["transmitter"], 0) + 1
    transmitters = ", ".join(f"{name} {count}" for name, count in sorted(counts.items()))
    interneurons = len(neurons) - 3
    weights = brain["weights"]
    synapses = brain["synapses"]
    left, right = neurons[1], neurons[2]
    reserved = brain["reserved"]
    lines = [
        f"dataset        {config['datasetRelease']} ({config['edgeVariant']})",
        f"neurons        {len(neurons)}   (sensory 1, left 1, right 1, interneurons {interneurons})",
        f"edges          {brain['edgeCount']}",
        f"transmitters   {transmitters}",
        f"weights        min {float(weights.min()):g}, max {float(weights.max()):g}; "
        f"synapses min {int(synapses.min())}, max {int(synapses.max())}",
        f"readouts       LEFT body {left['bodyId']} (two-hop input {brain['readoutInput']['left']:g}), "
        f"RIGHT body {right['bodyId']} (two-hop input {brain['readoutInput']['right']:g})",
        f"reserved       LEFT via body {reserved['left']}, RIGHT via body {reserved['right']}",
        f"output         {output} ({size} bytes)",
        f"self-check     {self_check}",
    ]
    return "\n".join(lines)


def extract(config_path, dataset_dir, out_path):
    config = load_config(config_path)
    dataset.check_files(dataset_dir)
    dataset.check_rows(dataset_dir, config["expect"])

    annotations = dataset.load_annotations(dataset_dir)
    transmitters = dataset.load_neurotransmitters(dataset_dir)
    bodies = admit(annotations, transmitters, config)
    if not bodies:
        raise ExtractError("E-SENSORY-NONE", "no body is admitted")
    edges = dataset.stream_edges(dataset_dir, sorted(bodies))

    brain = select_brain(config, bodies, edges)

    # Self-check: a second run on the same in-memory table must match byte for byte,
    # except provenance.createdAt (snapshot-format.md, Determinism).
    created_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    header = build_header(config, brain, created_at)
    again = select_brain(config, bodies, edges)
    again_header = build_header(config, again, created_at)
    if not (_same_body(brain, again) and _same_header(header, again_header)):
        raise ExtractError("E-NONDETERMINISTIC", "the second selection run differs from the first")

    size = write_container(out_path, header, brain["offsets"], brain["targets"],
                           brain["weights"], brain["synapses"])
    return report(config, brain, out_path, size, "identical")


def main(argv=None):
    parser = argparse.ArgumentParser(prog="malecns_brain")
    commands = parser.add_subparsers(dest="command", required=True)
    run = commands.add_parser("extract", help="write a brain container from the MaleCNS v1.0 release")
    run.add_argument("--config", required=True, help="extraction config (JSON)")
    run.add_argument("--dataset", help="directory with the Feather files (default: $MALECNS_DIR)")
    run.add_argument("--out", required=True, help="output .brain file")
    args = parser.parse_args(argv)

    dataset_dir = args.dataset or os.environ.get("MALECNS_DIR")
    if not dataset_dir:
        parser.error("no dataset directory: pass --dataset or set MALECNS_DIR")

    try:
        print(extract(args.config, dataset_dir, args.out))
    except ExtractError as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
