"""BUG-001 (spec 012): the class-seeded CSR must be indexed in container order, the order of `neurons`
(inputs, outputs, then interneurons by bodyId, container-v4 W5), because the JS reader and the LIF core take CSR
row k and target k to be neuron record k.

The shipped fixtures could not catch the bug: their pool bodyIds (101-405) are all smaller than every interneuron's
(601+), so bodyId order and container order coincide. These tests relabel the fixture bodies in reverse, so the two
orders differ, and check every CSR edge against the input edge table by bodyId. The fixture is SYNTHETIC
(Constitution III)."""

import copy
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, HERE)

from test_selection_class_seed import admitted, edge_table, load  # noqa: E402
from malecns_brain.selection_class_seed import select_class_seed  # noqa: E402

RELABEL = 100000  # body b becomes RELABEL - b, which reverses the bodyId order


def relabelled(data):
    """The fixture with every bodyId b replaced by RELABEL - b, so pools now sort after interneurons."""
    out = copy.deepcopy(data)
    for row in out["annotations"]:
        row["bodyId"] = RELABEL - row["bodyId"]
    for row in out["transmitters"]:
        row["body"] = RELABEL - row["body"]
    out["edges"]["pre"] = [RELABEL - b for b in out["edges"]["pre"]]
    out["edges"]["post"] = [RELABEL - b for b in out["edges"]["post"]]
    return out


def csr_edges(brain):
    """The (pre bodyId, post bodyId) of every CSR edge, read the way the JS reader reads it."""
    body_of = [n["bodyId"] for n in brain["neurons"]]
    offsets, targets = brain["offsets"], brain["targets"]
    edges = set()
    for row in range(len(body_of)):
        for k in range(int(offsets[row]), int(offsets[row + 1])):
            edges.add((body_of[row], body_of[int(targets[k])]))
    return edges


class CsrOrderTest(unittest.TestCase):
    def check(self, data):
        config = data["config"]
        brain = select_class_seed(config, admitted(data, config), edge_table(data))
        in_brain = {n["bodyId"] for n in brain["neurons"]}
        outputs = {n["bodyId"] for n in brain["neurons"] if n["role"] == "output"}
        pre, post, syn = edge_table(data)
        expected = {(int(a), int(b)) for a, b, s in zip(pre, post, syn)
                    if s >= config["minSynapses"] and a in in_brain and b in in_brain and a not in outputs}
        self.assertEqual(csr_edges(brain), expected)
        # Output rows are sinks in container order (ADR 003 D2), which is what the runner reads.
        for k, n in enumerate(brain["neurons"]):
            if n["role"] == "output":
                self.assertEqual(int(brain["offsets"][k + 1] - brain["offsets"][k]), 0, n["bodyId"])
        # Pools index the same records.
        for cid, members in brain["pools"].items():
            self.assertTrue(all(brain["neurons"][k]["channel"] == cid for k in members))
        return brain

    def test_shipped_fixture_order(self):
        self.check(load())

    def test_reversed_body_ids_keep_every_edge_on_its_own_neurons(self):
        data = relabelled(load())
        brain = self.check(data)
        # The relabelling really does separate the two orders (else this test proves nothing).
        body_of = [n["bodyId"] for n in brain["neurons"]]
        self.assertNotEqual(body_of, sorted(body_of))

    def test_weights_follow_their_edges_under_relabelling(self):
        base = select_class_seed(load()["config"], admitted(load()), edge_table(load()))
        data = relabelled(load())
        moved = select_class_seed(data["config"], admitted(data), edge_table(data))

        def weight_by_body(brain, unmap=lambda b: b):
            body_of = [unmap(n["bodyId"]) for n in brain["neurons"]]
            out = {}
            for row in range(len(body_of)):
                for k in range(int(brain["offsets"][row]), int(brain["offsets"][row + 1])):
                    out[(body_of[row], body_of[int(brain["targets"][k])])] = float(brain["weights"][k])
            return out

        self.assertEqual(weight_by_body(moved, lambda b: RELABEL - b), weight_by_body(base))

    def test_fidelity_report_is_unchanged_by_relabelling(self):
        base = select_class_seed(load()["config"], admitted(load()), edge_table(load()))
        data = relabelled(load())
        moved = select_class_seed(data["config"], admitted(data), edge_table(data))
        for key, value in base["fidelity"]["table"].items():
            self.assertTrue(np.isclose(moved["fidelity"]["table"][key]["brain"], value["brain"]), key)


if __name__ == "__main__":
    unittest.main()
