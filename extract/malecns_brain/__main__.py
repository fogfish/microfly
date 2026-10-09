"""Command line: python -m malecns_brain extract --config <file> [--dataset <dir>] --out <file.brain>

Exit status: 0 written and self-check identical; 1 an ExtractError (no file written); 2 usage.
"""

import argparse
import copy
import os
import sys
from datetime import datetime, timezone

import numpy as np

from . import __version__
from . import dataset
from .admission import admit_forager
from .config import config_hash, format_of, load_config
from .container import write_container
from .errors import ExtractError
from .selection import admit, select_brain
from .selection_forager import select_forager


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
            "positionSource": "body-annotations-male-cns-v1.0-minconf-0.5.feather:somaLocation",
        },
        "synapseCap": config["synapseCap"],
        "neuronCount": len(brain["neurons"]),
        "edgeCount": brain["edgeCount"],
        "neurons": brain["neurons"],
        "capabilities": config["capabilities"],
    }


def build_header_forager(config, brain, created_at):
    """The version 4 container header (container-v4.md) for a forager brain. The channels of the declaration get the
    neuron indices of their pools; the config declares them without neurons."""
    capabilities = copy.deepcopy(config["capabilities"])
    for channel in capabilities["channels"]["inputs"] + capabilities["channels"]["outputs"]:
        channel["neurons"] = brain["pools"][channel["id"]]
    return {
        "provenance": {
            "datasetRelease": config["datasetRelease"],
            "edgeVariant": config["edgeVariant"],
            "minConfidence": config["minConfidence"],
            "configHash": config_hash(config),
            "toolVersion": __version__,
            "createdAt": created_at,
            "positionSource": "body-annotations-male-cns-v1.0-minconf-0.5.feather:somaLocation",
        },
        "kind": config["kind"],
        "synapseCap": config["synapseCap"],
        "weightRule": config["weightRule"],
        "neuronCount": len(brain["neurons"]),
        "edgeCount": brain["edgeCount"],
        "neurons": brain["neurons"],
        "capabilities": capabilities,
        "modulators": config["modulators"],
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
    with_soma = sum(1 for n in neurons if isinstance(n["soma"], list))
    weights = brain["weights"]
    synapses = brain["synapses"]
    left, right = neurons[1], neurons[2]
    reserved = brain["reserved"]
    lines = [
        f"dataset        {config['datasetRelease']} ({config['edgeVariant']})",
        f"neurons        {len(neurons)}   (sensory 1, left 1, right 1, interneurons {interneurons})",
        f"edges          {brain['edgeCount']}",
        f"positions      {with_soma} with soma, {len(neurons) - with_soma} without",
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


def report_forager(config, brain, output, size, self_check):
    """Per pool and per output: counts, side balance, edges into each output, weight range and the self-check."""
    neurons = brain["neurons"]
    pools = brain["pools"]
    incoming = np.bincount(brain["targets"].astype(np.int64), minlength=len(neurons))
    lines = [
        f"dataset        {config['datasetRelease']} ({config['edgeVariant']}), forager kind",
        f"neurons        {len(neurons)}   (inputs {sum(1 for n in neurons if n['role'] == 'input')}, "
        f"outputs {sum(1 for n in neurons if n['role'] == 'output')}, "
        f"interneurons {sum(1 for n in neurons if n['role'] == 'interneuron')})",
        f"edges          {brain['edgeCount']}",
        "pools:",
    ]
    for cid in pools:
        lines.append(f"  {cid:<14} {len(pools[cid]):>5} neurons, {int(sum(incoming[pools[cid]])):>7} edges in")
    for pathway in ("odour", "taste"):
        left = [c for c in config["pathways"][pathway] if config["inputs"][c]["rootSide"] == "L"][0]
        right = [c for c in config["pathways"][pathway] if config["inputs"][c]["rootSide"] == "R"][0]
        lines.append(f"side balance   {pathway}: left {len(pools[left])}, right {len(pools[right])}")
    feed = pools["feed"]
    lines.append(f"edges into outputs: " + ", ".join(
        f"{cid} {int(sum(incoming[pools[cid]]))}" for cid in config["outputs"]))
    lines.append(f"feed (MN9) edges {int(sum(incoming[feed]))} from {len(feed)} neuron(s)")
    for rule_report in brain["pathwayBias"]:
        lines.append(
            f"pathwayBias {rule_report['id']:<20} boosted {rule_report['boosted']:>4}, "
            f"admittedOnlyByRule {rule_report['admittedOnlyByRule']:>4}")
    weights = brain["weights"]
    synapses = brain["synapses"]
    lines += [
        f"weights        min {float(weights.min()):g}, max {float(weights.max()):g}; "
        f"synapses min {int(synapses.min())}, max {int(synapses.max())}",
        f"output         {output} ({size} bytes)",
        f"self-check     {self_check}",
    ]
    return "\n".join(lines)


def extract_forager(config, dataset_dir, out_path):
    """The forager kind (ADR 003): pools, side matching, flow ranking, weights, container version 4."""
    dataset.check_files(dataset_dir)
    dataset.check_rows(dataset_dir, config["expect"])

    annotations = dataset.load_annotations(dataset_dir, dataset.FORAGER_ANNOTATION_COLUMNS)
    transmitters = dataset.load_neurotransmitters(dataset_dir)
    pool_types = {t for spec in config["outputs"].values() for t in spec["types"]}
    bodies = admit_forager(annotations, transmitters, config, pool_types)
    if not bodies:
        raise ExtractError("E-POOL-EMPTY", "no body is admitted")
    edges = dataset.stream_edges(dataset_dir, sorted(bodies))

    brain = select_forager(config, bodies, edges)

    # Self-check (as the small brain): a second run must match byte for byte, except provenance.createdAt.
    created_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    header = build_header_forager(config, brain, created_at)
    again = select_forager(config, bodies, edges)
    again_header = build_header_forager(config, again, created_at)
    if not (_same_body(brain, again) and _same_header(header, again_header)):
        raise ExtractError("E-NONDETERMINISTIC", "the second selection run differs from the first")

    size = write_container(out_path, header, brain["offsets"], brain["targets"],
                           brain["weights"], brain["synapses"])
    return report_forager(config, brain, out_path, size, "identical")


def extract(config_path, dataset_dir, out_path):
    config = load_config(config_path)
    if format_of(config) == "forager":
        return extract_forager(config, dataset_dir, out_path)
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
