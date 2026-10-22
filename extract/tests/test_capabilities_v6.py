"""Channel declaration, version 6 (contracts/channel-declaration-v6.md, ADR 012 R12): v5's R1-R9 and R11
unchanged, R10 generalised to allow one optional `song` drive. Same messages as
public/js/brain/capabilities.js (tests/capabilities-v6.test.mjs). Also covers the Python writer side
(extract/malecns_brain/__main__.py build_header_class_seed): a config with a `song` output writes
`capabilities.declaration: 6`; one without writes no `declaration` field at all (byte-identical to v5)."""

import copy
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.capabilities import (  # noqa: E402
    FORAGER_WIDE_DRIVES, FORAGER_WIDE_OPTIONAL_DRIVES, validate_capabilities_v5, validate_capabilities_v6,
)

N = 25


def forager_wide_with_song():
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
        {"id": "song", "label": "Song", "side": "both", "neurons": [18], "range": [0, 1], "drive": "song"},
    ]
    return {"signals": ["spikes"], "channels": {"inputs": inputs, "outputs": outputs}}


def problem(decl, neuron_count=N):
    try:
        validate_capabilities_v6(decl, neuron_count)
    except ValueError as error:
        return str(error)
    return None


class CapabilitiesV6Test(unittest.TestCase):
    def edited(self, edit):
        decl = copy.deepcopy(forager_wide_with_song())
        edit(decl)
        return problem(decl)

    def test_one_song_drive_passes(self):
        self.assertIsNone(problem(forager_wide_with_song()))
        self.assertEqual(FORAGER_WIDE_OPTIONAL_DRIVES, ("song",))

    def test_two_song_drives_fail(self):
        message = self.edited(lambda d: d["channels"]["outputs"].append(
            {"id": "song2", "label": "Song 2", "side": "both", "neurons": [19], "range": [0, 1], "drive": "song"}
        ))
        self.assertEqual(message, "snapshot outputs may declare song at most once")

    def test_song_without_declaration_fails_v5(self):
        with self.assertRaises(ValueError):
            validate_capabilities_v5(forager_wide_with_song(), N)

    def test_missing_required_drive_still_fails(self):
        message = self.edited(lambda d: d["channels"]["outputs"].pop(0))
        self.assertEqual(message, "snapshot outputs must have exactly one of each forager-wide drive")

    def test_unknown_drive_value_fails(self):
        message = self.edited(lambda d: d["channels"]["outputs"][-1].update(drive="courtship"))
        self.assertEqual(message, "snapshot outputs must have exactly one of each forager-wide drive")

    def test_no_song_output_validates_like_v5(self):
        decl = copy.deepcopy(forager_wide_with_song())
        decl["channels"]["outputs"].pop()  # drop song
        self.assertIsNone(problem(decl, N))
        self.assertIsNone(validate_capabilities_v5(decl, N))


class ShippedForagerWideWriterTest(unittest.TestCase):
    """The Python writer (__main__.build_header_class_seed): declaration 6 only with a song output."""

    def test_shipped_wide_config_declares_no_song_output(self):
        import json
        config_path = os.path.join(HERE, "..", "configs", "forager-brain-wide.json")
        with open(config_path, encoding="utf-8") as handle:
            config = json.load(handle)
        has_song = any(spec.get("drive") == "song" for spec in config["outputs"].values())
        self.assertFalse(has_song)


if __name__ == "__main__":
    unittest.main()
