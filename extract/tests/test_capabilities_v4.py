"""Channel declaration, version 4 (contracts/channel-declaration-v4.md): rules R1–R8 with the same messages
as public/js/brain/capabilities.js (tests/capabilities-v4.test.mjs)."""

import copy
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.capabilities import FORAGER_DRIVES, validate_capabilities_v4  # noqa: E402

N = 10


def forager():
    inputs = [
        {"id": "odour-left", "label": "Odour left", "side": "L", "neurons": [0, 1], "range": [0, 1]},
        {"id": "odour-right", "label": "Odour right", "side": "R", "neurons": [2], "range": [0, 1]},
        {"id": "taste-left", "label": "Taste left", "side": "L", "neurons": [3], "range": [0, 1]},
    ]
    outputs = [
        {"id": "turn-left", "label": "Turn left", "side": "L", "neurons": [4], "range": [0, 1], "drive": "turnLeft"},
        {"id": "turn-right", "label": "Turn right", "side": "R", "neurons": [5], "range": [0, 1], "drive": "turnRight"},
        {"id": "forward", "label": "Forward", "side": "both", "neurons": [6], "range": [0, 1], "drive": "forward"},
        {"id": "backward", "label": "Backward", "side": "both", "neurons": [7], "range": [0, 1], "drive": "backward"},
        {"id": "feed", "label": "Feed", "side": "both", "neurons": [8], "range": [0, 1], "drive": "feed"},
    ]
    return {"signals": ["spikes"], "channels": {"inputs": inputs, "outputs": outputs}}


def problem(decl, neuron_count=N, kind="forager"):
    """The message the validator gives, or None when it passes."""
    try:
        validate_capabilities_v4(decl, neuron_count, kind)
    except ValueError as error:
        return str(error)
    return None


class CapabilitiesV4Test(unittest.TestCase):
    def edited(self, edit):
        decl = copy.deepcopy(forager())
        edit(decl)
        return problem(decl)

    def test_valid_forager_passes(self):
        self.assertIsNone(problem(forager()))
        self.assertEqual(list(FORAGER_DRIVES), ["turnLeft", "turnRight", "forward", "backward", "feed"])

    def test_r1_missing(self):
        self.assertEqual(problem(None), "snapshot capabilities are missing")

    def test_r2_shape(self):
        self.assertEqual(self.edited(lambda d: d.update(signals=["spikes", "spikes"])),
                         "snapshot signals are malformed")
        self.assertEqual(self.edited(lambda d: d["channels"].update(inputs="odour")),
                         "snapshot channels are malformed")

    def test_r3_ids(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][0].update(id="Odour")),
                         "snapshot channel Odour has a malformed id")
        self.assertEqual(self.edited(lambda d: d["channels"]["outputs"][0].update(id="odour-left")),
                         "duplicate id odour-left")

    def test_r4_fields(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][0].update(label="")),
                         "snapshot channel odour-left is malformed: label")
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][0].update(side="left")),
                         "snapshot channel odour-left is malformed: side")
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][0].update(neurons=[])),
                         "snapshot channel odour-left is malformed: neurons")
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][0].update(neurons=[0, 0])),
                         "snapshot channel odour-left is malformed: neurons")
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][0].update(range=[1, 0])),
                         "snapshot channel odour-left is malformed: range")

    def test_r5_range(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["outputs"][4].update(neurons=[N])),
                         f"snapshot channel feed references neuron {N} outside neuronCount")

    def test_r6_shared_input_neuron(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][1].update(neurons=[1])),
                         "snapshot input channels odour-left and odour-right share neuron 1")

    def test_r7_drives(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["outputs"][4].update(drive="forward")),
                         "snapshot outputs must have exactly one of each forager drive")
        self.assertEqual(self.edited(lambda d: d["channels"]["outputs"].pop()),
                         "snapshot outputs must have exactly one of each forager drive")

    def test_r8_fields(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][0].update(drive="forward")),
                         "snapshot channel odour-left has unknown field drive")
        self.assertEqual(self.edited(lambda d: d["channels"]["outputs"][0].update(neuron=4)),
                         "snapshot channel turn-left has unknown field neuron")


if __name__ == "__main__":
    unittest.main()
