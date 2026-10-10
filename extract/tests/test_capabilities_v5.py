"""Channel declaration, version 5 (contracts/channel-declaration-v5.md): rules R1–R11 with the same messages as
public/js/brain/capabilities.js (tests/capabilities-v5.test.mjs), plus a regression that validate_capabilities_v4
still enforces 5 drives and rejects escape."""

import copy
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.capabilities import FORAGER_DRIVES, FORAGER_DRIVES_V2, validate_capabilities_v4, \
    validate_capabilities_v5  # noqa: E402

N = 20


def forager_v2():
    def input_channel(cid, label, side, sense, site, neurons):
        return {"id": cid, "label": label, "side": side, "neurons": neurons, "range": [0, 1],
                "sense": sense, "site": site}

    def output_channel(cid, label, side, drive, neurons):
        return {"id": cid, "label": label, "side": side, "neurons": neurons, "range": [0, 1], "drive": drive}

    inputs = [
        input_channel("odour-food-left", "Odour food left", "L", "odour:food", "antenna", [0]),
        input_channel("odour-food-right", "Odour food right", "R", "odour:food", "antenna", [1]),
        input_channel("taste-mouth-left", "Taste mouth left", "L", "taste:mouth", "mouth", [2]),
    ]
    outputs = [
        output_channel("turn-left", "Turn left", "L", "turnLeft", [10]),
        output_channel("turn-right", "Turn right", "R", "turnRight", [11]),
        output_channel("forward", "Forward", "both", "forward", [12]),
        output_channel("backward", "Backward", "both", "backward", [13]),
        output_channel("feed", "Feed", "both", "feed", [14]),
        output_channel("escape", "Escape", "both", "escape", [15]),
    ]
    return {"signals": ["spikes"], "channels": {"inputs": inputs, "outputs": outputs}}


def problem(decl, neuron_count=N):
    try:
        validate_capabilities_v5(decl, neuron_count)
    except ValueError as error:
        return str(error)
    return None


class CapabilitiesV5Test(unittest.TestCase):
    def edited(self, edit):
        decl = copy.deepcopy(forager_v2())
        edit(decl)
        return problem(decl)

    def test_valid_declaration_passes(self):
        self.assertIsNone(problem(forager_v2()))
        self.assertEqual(list(FORAGER_DRIVES_V2),
                          ["turnLeft", "turnRight", "forward", "backward", "feed", "escape"])

    def test_r9_sense_must_be_one_of_the_six_declared_senses(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][0].update(sense="smell")),
                         "snapshot channel odour-food-left is malformed: sense")

    def test_r10_site_must_be_one_of_the_declared_body_sites(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][0].update(site="leg")),
                         "snapshot channel odour-food-left is malformed: site")

    def test_r11_exactly_one_escape_drive(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["outputs"][5].update(drive="forward")),
                         "snapshot outputs must have exactly one of each forager drive")
        self.assertEqual(self.edited(lambda d: d["channels"]["outputs"].pop()),
                         "snapshot outputs must have exactly one of each forager drive")

    def test_r7_six_drives_required(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["outputs"][0].update(drive="escape")),
                         "snapshot outputs must have exactly one of each forager drive")

    def test_r4_fields_reused(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["inputs"][0].update(label="")),
                         "snapshot channel odour-food-left is malformed: label")

    def test_r8_no_sense_site_on_outputs(self):
        self.assertEqual(self.edited(lambda d: d["channels"]["outputs"][0].update(sense="odour:food")),
                         "snapshot channel turn-left has unknown field sense")


class CapabilitiesV4RegressionTest(unittest.TestCase):
    """validate_capabilities_v4 is untouched by the v5 additions (research.md R2)."""

    def test_v4_still_rejects_escape_and_requires_five_drives(self):
        inputs = [{"id": "odour-left", "label": "Odour left", "side": "L", "neurons": [0], "range": [0, 1]}]
        outputs = [
            {"id": "turn-left", "label": "Turn left", "side": "L", "neurons": [1], "range": [0, 1],
             "drive": "turnLeft"},
            {"id": "turn-right", "label": "Turn right", "side": "R", "neurons": [2], "range": [0, 1],
             "drive": "turnRight"},
            {"id": "forward", "label": "Forward", "side": "both", "neurons": [3], "range": [0, 1],
             "drive": "forward"},
            {"id": "backward", "label": "Backward", "side": "both", "neurons": [4], "range": [0, 1],
             "drive": "backward"},
            {"id": "escape", "label": "Escape", "side": "both", "neurons": [5], "range": [0, 1], "drive": "escape"},
        ]
        decl = {"signals": ["spikes"], "channels": {"inputs": inputs, "outputs": outputs}}
        with self.assertRaises(ValueError) as caught:
            validate_capabilities_v4(decl, N, "forager")
        self.assertEqual(str(caught.exception), "snapshot outputs must have exactly one of each forager drive")
        self.assertEqual(list(FORAGER_DRIVES), ["turnLeft", "turnRight", "forward", "backward", "feed"])


if __name__ == "__main__":
    unittest.main()
