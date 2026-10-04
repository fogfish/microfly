"""Load and validate the extraction config (contracts/extract-config.md)."""

import hashlib
import json

from .errors import ExtractError

TOP_KEYS = {
    "formatVersion", "datasetRelease", "edgeVariant", "expect", "sensory",
    "readouts", "transmitterSign", "minConfidence", "synapseCap",
    "minInterneurons", "maxInterneurons", "expectedNeuronCount",
}
EXPECT_KEYS = {"annotationRows", "edgeRows", "neurotransmitterRows"}
SENSORY_KEYS = {"class", "status"}
READOUT_KEYS = {"superclass", "status", "somaSides"}
SIGNS = {1, -1}


def _fail(message):
    raise ExtractError("E-CONFIG", message)


def _is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _check_keys(section, name, allowed):
    if not isinstance(section, dict):
        _fail(f"{name} must be an object")
    unknown = sorted(set(section) - allowed)
    if unknown:
        _fail(f"unknown key in {name}: {unknown[0]}")
    missing = sorted(allowed - set(section))
    if missing:
        _fail(f"missing key in {name}: {missing[0]}")


def validate(config):
    """Raise E-CONFIG for an unknown key, a missing key or an out-of-range value."""
    if not isinstance(config, dict):
        _fail("config must be a JSON object")
    unknown = sorted(set(config) - TOP_KEYS)
    if unknown:
        _fail(f"unknown key: {unknown[0]}")
    missing = sorted(TOP_KEYS - set(config))
    if missing:
        _fail(f"missing key: {missing[0]}")

    if config["formatVersion"] != 2:
        _fail("formatVersion must be 2")
    if not isinstance(config["datasetRelease"], str) or not config["datasetRelease"]:
        _fail("datasetRelease must be a non-empty string")
    if config["edgeVariant"] != "traced-only":
        _fail("edgeVariant must be traced-only")

    _check_keys(config["expect"], "expect", EXPECT_KEYS)
    for key in sorted(EXPECT_KEYS):
        if not _is_int(config["expect"][key]) or config["expect"][key] < 0:
            _fail(f"expect.{key} must be an integer ≥ 0")

    _check_keys(config["sensory"], "sensory", SENSORY_KEYS)
    _check_keys(config["readouts"], "readouts", READOUT_KEYS)
    if config["readouts"]["somaSides"] != ["L", "R"]:
        _fail('readouts.somaSides must be exactly ["L","R"]')

    signs = config["transmitterSign"]
    if not isinstance(signs, dict) or not signs:
        _fail("transmitterSign must be a non-empty object")
    for transmitter, sign in signs.items():
        if not _is_int(sign) or sign not in SIGNS:
            _fail(f"transmitterSign value for {transmitter} must be 1 or -1")

    confidence = config["minConfidence"]
    if not _is_number(confidence) or not 0 <= confidence <= 1:
        _fail("minConfidence must be a number in [0, 1]")

    cap = config["synapseCap"]
    if not _is_int(cap) or not 1 <= cap <= 65535:
        _fail("synapseCap must be an integer in [1, 65535]")

    low, high = config["minInterneurons"], config["maxInterneurons"]
    if not _is_int(low) or low < 0:
        _fail("minInterneurons must be an integer ≥ 0")
    if not _is_int(high) or high < 0:
        _fail("maxInterneurons must be an integer ≥ 0")
    if high < low:
        _fail(f"maxInterneurons must be ≥ minInterneurons ({low})")

    expected = config["expectedNeuronCount"]
    if expected is not None and (not _is_int(expected) or expected < 3):
        _fail("expectedNeuronCount must be null or an integer ≥ 3")


def load_config(path):
    """Read, parse and validate the config file. Returns the config dict."""
    try:
        with open(path, "r", encoding="utf-8") as handle:
            config = json.load(handle)
    except FileNotFoundError:
        _fail(f"config file not found: {path}")
    except json.JSONDecodeError as error:
        _fail(f"malformed JSON in {path}: {error}")
    validate(config)
    return config


def config_hash(config):
    """sha256 of the canonical JSON (sorted keys, no whitespace)."""
    canonical = json.dumps(config, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()
