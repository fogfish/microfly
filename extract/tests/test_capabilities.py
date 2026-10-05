"""Declaration rules 11–18 (specs/006-fly-status-panel/contracts/snapshot-format-v3.md), exact messages."""

import copy
import math
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from malecns_brain.capabilities import validate_capabilities  # noqa: E402

# The valid declaration of T001 (the example in snapshot-format-v3.md).
VALID = {
    "signals": ["spikes"],
    "channels": {
        "inputs": [{"id": "food-odour", "label": "Food odour", "side": "both", "neuron": 0, "range": [0, 1]}],
        "outputs": [
            {"id": "left-motor", "label": "Left motor", "side": "L", "neuron": 1, "range": [0, 1], "drive": "left"},
            {"id": "right-motor", "label": "Right motor", "side": "R", "neuron": 2, "range": [0, 1], "drive": "right"},
        ],
    },
}


def declaration(mutate):
    decl = copy.deepcopy(VALID)
    mutate(decl)
    return decl


def inputs(decl):
    return decl["channels"]["inputs"]


def outputs(decl):
    return decl["channels"]["outputs"]


class CapabilitiesTest(unittest.TestCase):
    def assertRejects(self, decl, message, neuron_count=11):
        with self.assertRaises(ValueError) as caught:
            validate_capabilities(decl, neuron_count)
        self.assertEqual(str(caught.exception), message)

    def test_valid_declaration_passes(self):
        self.assertIsNone(validate_capabilities(VALID, 11))

    def test_empty_signals_and_no_inputs_are_valid(self):
        decl = declaration(lambda d: (d.update(signals=[]), d["channels"].update(inputs=[])))
        self.assertIsNone(validate_capabilities(decl, 11))

    def test_rule_11_missing_capabilities(self):
        self.assertRejects(None, "snapshot capabilities are missing")
        self.assertRejects([], "snapshot capabilities are missing")

    def test_rule_12_malformed_signals(self):
        self.assertRejects(declaration(lambda d: d.update(signals="spikes")), "snapshot signals are malformed")
        self.assertRejects(declaration(lambda d: d.update(signals=["spikes", "spikes"])),
                           "snapshot signals are malformed")

    def test_rule_12_unknown_signal_is_kept(self):
        self.assertIsNone(validate_capabilities(declaration(lambda d: d.update(signals=["membrane"])), 11))

    def test_rule_13_malformed_id(self):
        def bad(d):
            inputs(d)[0]["id"] = "Food"
        self.assertRejects(declaration(bad), "snapshot channel Food has a malformed id")

    def test_rule_13_duplicate_id_across_inputs_and_outputs(self):
        def dup(d):
            outputs(d)[0]["id"] = "food-odour"
        self.assertRejects(declaration(dup), "duplicate id food-odour")

    def test_rule_14_empty_label(self):
        def bad(d):
            outputs(d)[0]["label"] = ""
        self.assertRejects(declaration(bad), "snapshot channel left-motor is malformed: label")

    def test_rule_14_label_longer_than_forty_characters(self):
        def bad(d):
            outputs(d)[0]["label"] = "x" * 41
        self.assertRejects(declaration(bad), "snapshot channel left-motor is malformed: label")

    def test_rule_14_side_outside_the_three_values(self):
        def bad(d):
            outputs(d)[0]["side"] = "X"
        self.assertRejects(declaration(bad), "snapshot channel left-motor is malformed: side")

    def test_rule_14_range_with_min_not_below_max(self):
        def bad(d):
            outputs(d)[0]["range"] = [1, 1]
        self.assertRejects(declaration(bad), "snapshot channel left-motor is malformed: range")

    def test_rule_14_range_with_a_non_finite_bound(self):
        def bad(d):
            outputs(d)[0]["range"] = [0, math.inf]
        self.assertRejects(declaration(bad), "snapshot channel left-motor is malformed: range")

    def test_rule_14_a_missing_range_defaults_to_zero_one(self):
        def ok(d):
            del outputs(d)[0]["range"]
        self.assertIsNone(validate_capabilities(declaration(ok), 11))

    def test_rule_15_input_must_read_neuron_zero(self):
        def bad(d):
            inputs(d)[0]["neuron"] = 1
        self.assertRejects(declaration(bad), "snapshot input channel food-odour must read neuron 0")

    def test_rule_16_output_outside_neuron_count(self):
        def bad(d):
            outputs(d)[0]["neuron"] = 11
        self.assertRejects(declaration(bad), "snapshot output channel left-motor references neuron 11 outside neuronCount")

    def test_rule_17_outputs_need_exactly_one_left_and_one_right(self):
        def two_left(d):
            outputs(d)[1]["drive"] = "left"
        self.assertRejects(declaration(two_left), "snapshot outputs must have exactly one left and one right drive")

        def no_drive(d):
            for ch in outputs(d):
                del ch["drive"]
        self.assertRejects(declaration(no_drive), "snapshot outputs must have exactly one left and one right drive")

    def test_rule_17_unknown_drive_value(self):
        def bad(d):
            outputs(d)[0]["drive"] = "up"
        self.assertRejects(declaration(bad), "snapshot outputs must have exactly one left and one right drive")

    def test_rule_18_unknown_channel_field(self):
        def bad(d):
            outputs(d)[0]["gain"] = 2
        self.assertRejects(declaration(bad), "snapshot channel left-motor has unknown field gain")

    def test_rule_18_an_input_may_not_carry_a_drive(self):
        def bad(d):
            inputs(d)[0]["drive"] = "left"
        self.assertRejects(declaration(bad), "snapshot channel food-odour has unknown field drive")

    def test_first_error_wins_in_rule_order(self):
        # A bad label (rule 14) and a bad neuron (rule 16) on two channels: rule 14 is reported.
        def two(d):
            outputs(d)[0]["neuron"] = 99
            inputs(d)[0]["label"] = ""
        self.assertRejects(declaration(two), "snapshot channel food-odour is malformed: label")

    def test_subject_changes_only_the_leading_word(self):
        with self.assertRaises(ValueError) as caught:
            validate_capabilities(declaration(lambda d: outputs(d)[0].update(side="X")), 11, subject="config")
        self.assertEqual(str(caught.exception), "config channel left-motor is malformed: side")


if __name__ == "__main__":
    unittest.main()
