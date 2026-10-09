"""Gate A topology comparison for pathwayBias (012-pathway-aware-selection, ADR 003 D3'). Not a unit test.

Loads the MaleCNS v1.0 dataset once and runs `select_forager` twice in the same process: once with
`config["pathwayBias"]` forced to `[]` (today's shipped topology, guaranteed byte-equivalent by contract P1), once
with `forager-brain.json` as shipped. Prints the TopologyDiff (data-model.md): bodies added/removed per pathway
budget, the edge-count delta, and a sanity check that every added body's rule-seeded backward flow is actually
positive (confirming the diff is explained by the rule, not an unrelated side effect). This does not pass or fail —
it measures (AGENTS.md's "behaviour failures are findings").

Run from extract/:
    MALECNS_DIR=../data/malecns .venv/bin/python tests/compare_forager_topology.py
"""

import argparse
import copy
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, ROOT)

from malecns_brain import dataset  # noqa: E402
from malecns_brain.admission import admit_forager  # noqa: E402
from malecns_brain.config import load_config  # noqa: E402
from malecns_brain.selection_forager import select_forager  # noqa: E402

CONFIG = os.path.join(ROOT, "configs", "forager-brain.json")


def load_bodies_and_edges(config, dataset_dir):
    dataset.check_files(dataset_dir)
    dataset.check_rows(dataset_dir, config["expect"])
    annotations = dataset.load_annotations(dataset_dir, dataset.FORAGER_ANNOTATION_COLUMNS)
    transmitters = dataset.load_neurotransmitters(dataset_dir)
    pool_types = {t for spec in config["outputs"].values() for t in spec["types"]}
    bodies = admit_forager(annotations, transmitters, config, pool_types)
    edges = dataset.stream_edges(dataset_dir, sorted(bodies))
    return bodies, edges


def topology_diff(without_rule, with_rule, rule_ids):
    bodies_without = {n["bodyId"] for n in without_rule["neurons"] if n["role"] == "interneuron"}
    bodies_with = {n["bodyId"] for n in with_rule["neurons"] if n["role"] == "interneuron"}
    added = sorted(bodies_with - bodies_without)
    removed = sorted(bodies_without - bodies_with)
    edge_delta = with_rule["edgeCount"] - without_rule["edgeCount"]

    rule_explained = {}
    for body in added:
        best = 0.0
        for rule_id in rule_ids:
            flow = with_rule["pathwayBiasFlow"].get(rule_id, {})
            best = max(best, flow.get(body, 0.0))
        rule_explained[body] = best

    return {
        "addedBodies": added,
        "removedBodies": removed,
        "edgeCountDelta": edge_delta,
        "ruleExplained": rule_explained,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default=os.environ.get("MALECNS_DIR"))
    args = parser.parse_args()
    if not args.dataset:
        parser.error("no dataset: pass --dataset or set MALECNS_DIR")

    config = load_config(CONFIG)
    bodies, edges = load_bodies_and_edges(config, args.dataset)

    config_without = copy.deepcopy(config)
    config_without["pathwayBias"] = []
    without_rule = select_forager(config_without, bodies, edges)
    with_rule = select_forager(config, bodies, edges)

    rule_ids = [rule["id"] for rule in config["pathwayBias"]]
    diff = topology_diff(without_rule, with_rule, rule_ids)

    print(f"pathwayBias rules: {', '.join(rule_ids) or '(none)'}")
    print(f"added bodies   ({len(diff['addedBodies'])}): {diff['addedBodies']}")
    print(f"removed bodies ({len(diff['removedBodies'])}): {diff['removedBodies']}")
    print(f"edge count delta: {diff['edgeCountDelta']:+d} "
          f"(without {without_rule['edgeCount']}, with {with_rule['edgeCount']})")
    print("ruleExplained (added body -> strictly-positive rule-seeded backward flow):")
    all_positive = True
    for body, flow in diff["ruleExplained"].items():
        print(f"  {body}: {flow:.6f}")
        all_positive = all_positive and flow > 0.0
    if diff["addedBodies"]:
        print(f"every added body explained by a positive rule-seeded backward flow: {all_positive}")
    else:
        print("no body was added by the rule on this dataset")
    print(f"significant difference: {bool(diff['addedBodies'] or diff['removedBodies'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
