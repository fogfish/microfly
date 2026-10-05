"""Channel and signal declaration, version 3 (specs/006-fly-status-panel/contracts/snapshot-format-v3.md).

Rules 11–18, checked in rule order: the first error wins. The browser applies the same rules with
the same messages (public/js/brain/capabilities.js). `subject` only changes the leading word, so the
extract config reports "config ..." and a snapshot reader reports "snapshot ...".
"""

import math
import re

DECLARATION_FIELDS = ("id", "label", "side", "neuron", "range", "drive")
INPUT_FIELDS = ("id", "label", "side", "neuron", "range")
SIDES = ("L", "R", "both")
DRIVES = ("left", "right")
ID_PATTERN = re.compile(r"[a-z][a-z0-9-]*")
LABEL_MAX = 40
DEFAULT_RANGE = [0, 1]


def _fail(message):
    raise ValueError(message)


def _is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _name(channel):
    return channel.get("id") if isinstance(channel, dict) else None


def validate_capabilities(decl, neuron_count, subject="snapshot"):
    """Raise ValueError with the first rule message that fails. Returns None when valid.

    neuron_count may be math.inf when the count is not yet known (the config checks ids only).
    """
    # Rule 11: present and an object.
    if not isinstance(decl, dict):
        _fail(f"{subject} capabilities are missing")

    # Rule 12: signals are unique strings. Unknown ids are allowed (rule 18).
    signals = decl.get("signals")
    if not (isinstance(signals, list) and all(isinstance(s, str) for s in signals)
            and len(set(signals)) == len(signals)):
        _fail(f"{subject} signals are malformed")

    channels = decl.get("channels")
    if not (isinstance(channels, dict) and isinstance(channels.get("inputs"), list)
            and isinstance(channels.get("outputs"), list)):
        _fail(f"{subject} channels are malformed")
    inputs, outputs = channels["inputs"], channels["outputs"]
    everything = [(ch, "input") for ch in inputs] + [(ch, "output") for ch in outputs]

    # Rule 13: ids match the pattern and are unique across inputs and outputs.
    seen = set()
    for channel, _ in everything:
        cid = _name(channel)
        if not (isinstance(cid, str) and ID_PATTERN.fullmatch(cid)):
            _fail(f"{subject} channel {cid} has a malformed id")
        if cid in seen:
            _fail(f"duplicate id {cid}")
        seen.add(cid)

    # Rule 14: label, side, neuron (integer) and range (two finite numbers, min < max; default [0, 1]).
    for channel, _ in everything:
        cid = channel["id"]
        label = channel.get("label")
        if not (isinstance(label, str) and 0 < len(label) <= LABEL_MAX):
            _fail(f"{subject} channel {cid} is malformed: label")
        if channel.get("side") not in SIDES:
            _fail(f"{subject} channel {cid} is malformed: side")
        if not _is_int(channel.get("neuron")):
            _fail(f"{subject} channel {cid} is malformed: neuron")
        rng = channel.get("range", DEFAULT_RANGE)
        if not (isinstance(rng, list) and len(rng) == 2 and all(_is_number(x) for x in rng) and rng[0] < rng[1]):
            _fail(f"{subject} channel {cid} is malformed: range")

    # Rule 15: each input reads neuron 0.
    for channel in inputs:
        if channel["neuron"] != 0:
            _fail(f"{subject} input channel {channel['id']} must read neuron 0")

    # Rule 16: each output reads a neuron below neuronCount.
    for channel in outputs:
        neuron = channel["neuron"]
        if not (0 <= neuron < neuron_count):
            _fail(f"{subject} output channel {channel['id']} references neuron {neuron} outside neuronCount")

    # Rule 17: drive is absent, "left" or "right", and the drives are exactly one of each.
    drives = []
    for channel in outputs:
        if "drive" not in channel:
            continue
        if channel["drive"] not in DRIVES:
            _fail(f"{subject} outputs must have exactly one left and one right drive")
        drives.append(channel["drive"])
    if sorted(drives) != ["left", "right"]:
        _fail(f"{subject} outputs must have exactly one left and one right drive")

    # Rule 18: no fields beyond the declaration (inputs take no drive).
    for channel, kind in everything:
        allowed = INPUT_FIELDS if kind == "input" else DECLARATION_FIELDS
        for key in channel:
            if key not in allowed:
                _fail(f"{subject} channel {channel['id']} has unknown field {key}")
