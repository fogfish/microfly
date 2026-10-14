"""Channel declaration, version 5 (contracts/channel-declaration-v5.md): rules R9-R11 with the same messages
as public/js/brain/capabilities.js (tests/capabilities-v5.test.mjs)."""

import copy
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.capabilities import FORAGER_WIDE_DRIVES, validate_capabilities_v5  # noqa: E402

N = 24


def forager_wide():
    def pair(cid, label, side, neuron, sense, site):
        return {"id": cid, "label": label, "side": side, "neurons": [neuron], "range": [0, 1],
                "sense": sense, "site": site}

    inputs = [
        pair("odour-food-left", "Food odour left", "L", 0, "odour:food", "antenna"),
        pair("odour-food-right", "Food odour right", "R", 1, "odour:food", "antenna"),
        pair("odour-danger-left", "Danger odour left", "L", 2, "odour:danger", "antenna"),
        pair("odour-danger-right", "Danger odour right", "R", 3, "odour:danger", "antenna"),
        pair("heat-left", "Heat left", "L", 4, "heat", "antenna"),
        pair("heat-right", "Heat right", "R", 5, "heat", "antenna"),
        pair("taste-mouth-left", "Mouth taste left", "L", 6, "taste", "mouth"),
        pair("taste-mouth-right", "Mouth taste right", "R", 7, "taste", "mouth"),
        pair("taste-leg-left", "Leg taste left", "L", 8, "taste", "front-leg"),
        pair("taste-leg-right", "Leg taste right", "R", 9, "taste", "front-leg"),
        pair("touch-left", "Touch left", "L", 10, "touch", "front-leg"),
        pair("touch-right", "Touch right", "R", 11, "touch", "front-leg"),
    ]
    outputs = [
        {"id": "turn-left", "label": "Turn left", "side": "L", "neurons": [12], "range": [0, 1], "drive": "turnLeft"},
        {"id": "turn-right", "label": "Turn right", "side": "R", "neurons": [13], "range": [0, 1], "drive": "turnRight"},
        {"id": "forward", "label": "Forward", "side": "both", "neurons": [14], "range": [0, 1], "drive": "forward"},
        {"id": "backward", "label": "Backward", "side": "both", "neurons": [15], "range": [0, 1], "drive": "backward"},
        {"id": "feed", "label": "Feed", "side": "both", "neurons": [16], "range": [0, 1], "drive": "feed"},
        {"id": "escape", "label": "Escape", "side": "both", "neurons": [17], "range": [0, 1], "drive": "escape"},
    ]
    return {"signals": ["spikes"], "channels": {"inputs": inputs, "outputs": outputs}}


def problem(decl, neuron_count=N):
    """The message the validator gives, or None when it passes."""
    try:
        validate_capabilities_v5(decl, neuron_count)
    except ValueError as error:
        return str(error)
    return None


class CapabilitiesV5Test(unittest.TestCase):
    def edited(self, edit):
        decl = copy.deepcopy(forager_wide())
        edit(decl)
        return problem(decl)

    def test_valid_forager_wide_passes(self):
        self.assertIsNone(problem(forager_wide()))
        self.assertEqual(list(FORAGER_WIDE_DRIVES),
                          ["turnLeft", "turnRight", "forward", "backward", "feed", "escape"])

    def test_r9_missing_sense(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][0].pop("sense")),
                         "snapshot channel odour-food-left is malformed: sense")
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][0].update(sense="")),
                         "snapshot channel odour-food-left is malformed: sense")

    def test_r9_missing_site(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][0].pop("site")),
                         "snapshot channel odour-food-left is malformed: site")

    def test_r10_wrong_missing_or_duplicate_drive(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["outputs"][5].update(drive="feed")),
                         "snapshot outputs must have exactly one of each forager-wide drive")
        self.assertEqual(self.edited(lambda d: d["channels"]["outputs"].pop()),
                         "snapshot outputs must have exactly one of each forager-wide drive")

    def test_r11_unknown_field(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["outputs"][0].update(sense="odour:food")),
                         "snapshot channel turn-left has unknown field sense")
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][0].update(neuron=0)),
                         "snapshot channel odour-food-left has unknown field neuron")


if __name__ == "__main__":
    unittest.main()
