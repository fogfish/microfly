"""Load and validate the extraction config (contracts/extract-config.md)."""

import copy
import hashlib
import json
import math
import re

from .capabilities import FORAGER_DRIVES, validate_capabilities, validate_capabilities_v4
from .errors import ExtractError

TOP_KEYS = {
    "formatVersion", "datasetRelease", "edgeVariant", "expect", "sensory",
    "readouts", "transmitterSign", "minConfidence", "synapseCap",
    "minInterneurons", "maxInterneurons", "expectedNeuronCount", "capabilities",
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
    if "capabilities" not in config:
        _fail("capabilities is required")
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

    # The neuron bound (rule 16) is checked again when the container is written, with the real count.
    bound = expected if _is_int(expected) else math.inf
    try:
        validate_capabilities(config["capabilities"], bound, subject="config")
    except ValueError as error:
        _fail(str(error))


def format_of(config):
    """Dispatch on the pair (formatVersion, kind): 'small' for 2 without kind, 'forager' for 3 with kind forager.

    Any other pair stops with E-CONFIG naming the key (contracts/extract-config-forager.md).
    """
    if not isinstance(config, dict):
        _fail("config must be a JSON object")
    version = config.get("formatVersion")
    if version not in (2, 3):
        _fail("formatVersion must be 2 (small brain) or 3 (forager brain)")
    if version == 2:
        if "kind" in config:
            _fail("kind is not allowed with formatVersion 2")
        return "small"
    if "kind" not in config:
        _fail('kind is required with formatVersion 3 and must be "forager"')
    if config["kind"] != "forager":
        _fail('kind must be "forager" with formatVersion 3')
    return "forager"


FORAGER_KEYS = {
    "formatVersion", "kind", "datasetRelease", "edgeVariant", "expect", "transmitterSign", "minConfidence",
    "synapseCap", "inputs", "sideMatch", "outputs", "pathways", "flowSteps", "budget",
    "excludeInterneuronClasses", "excludeInterneuronSuperclassSuffix", "weightRule", "outputAdmission",
    "modulators", "capabilities", "expectedNeuronCount", "neuronCountRange",
}
INPUT_KEYS = {"class", "rootSide", "types", "subclasses", "typePrefixes"}
OUTPUT_KEYS = {"types", "somaSide", "drive"}
MODULATOR_ID = re.compile(r"[a-z][a-z0-9-]*")


def _is_str_list(value, allow_empty=False):
    return isinstance(value, list) and (allow_empty or len(value) > 0) and all(isinstance(v, str) and v for v in value)


def _modulator(message):
    raise ExtractError("E-MODULATOR", message)


def _check_modulators(modulators, inputs, path="modulators"):
    """M1–M3 of container-v4.md, checked at extraction (E-MODULATOR)."""
    if not isinstance(modulators, list):
        _fail(f"{path} must be a list")
    earlier = set()
    for index, mod in enumerate(modulators):
        if not isinstance(mod, dict):
            _modulator(f"{path}[{index}] must be an object")
        mid = mod.get("id")
        if not (isinstance(mid, str) and MODULATOR_ID.fullmatch(mid)):
            _modulator(f"{path}[{index}] has a malformed id")
        label = mod.get("label")
        if not (isinstance(label, str) and 0 < len(label) <= 40):
            _modulator(f"modulator {mid} has a malformed label")
        targets = mod.get("targets")
        if not _is_str_list(targets):
            _modulator(f"modulator {mid} needs a non-empty list of targets")
        for target in targets:
            if target not in inputs:
                _modulator(f"modulator {mid} targets an undeclared input {target}")
        gain = mod.get("gain")
        if not (isinstance(gain, list) and len(gain) == 2 and all(_is_number(g) and g >= 0 for g in gain)):
            _modulator(f"modulator {mid} gain must be two numbers of 0 or more")
        has_range, has_source = "range" in mod, "source" in mod
        if has_range == has_source:
            _modulator(f"modulator {mid} needs either range or source")
        if has_range and mod["range"] != [0, 1]:
            _modulator(f"modulator {mid} range must be [0, 1]")
        if has_source and mod["source"] not in earlier:
            _modulator(f"modulator {mid} source {mod['source']} is not an earlier modulator")
        earlier.add(mid)


def _check_forager_capabilities(decl, inputs, outputs):
    """Rule C1 (ids and drives match the pools), then R1–R4, R7 and R8 of the v4 declaration.

    The pool members are not known before selection, so each channel gets a placeholder neuron for the check.
    R5 and R6 are checked again when the container is written, with the real neurons.
    """
    if isinstance(decl, dict) and isinstance(decl.get("channels"), dict):
        channels = decl["channels"]
        declared_in = [ch.get("id") for ch in channels.get("inputs", []) if isinstance(ch, dict)]
        declared_out = {ch.get("id"): ch.get("drive") for ch in channels.get("outputs", []) if isinstance(ch, dict)}
        for cid in declared_in:
            if cid not in inputs:
                _fail(f"capabilities input {cid} is not declared in inputs")
        for cid in inputs:
            if cid not in declared_in:
                _fail(f"inputs {cid} is missing from capabilities")
        for cid, drive in declared_out.items():
            if cid not in outputs:
                _fail(f"capabilities output {cid} is not declared in outputs")
            if drive != outputs[cid]["drive"]:
                _fail(f"capabilities output {cid} has drive {drive}, outputs declares {outputs[cid]['drive']}")
        for cid in outputs:
            if cid not in declared_out:
                _fail(f"outputs {cid} is missing from capabilities")

        template = copy.deepcopy(decl)
        template_channels = template["channels"]
        everything = [ch for ch in template_channels.get("inputs", []) + template_channels.get("outputs", [])
                      if isinstance(ch, dict)]
        for slot, channel in enumerate(everything):
            channel["neurons"] = [slot]
        decl = template
    try:
        validate_capabilities_v4(decl, math.inf, "forager", subject="config")
    except ValueError as error:
        _fail(str(error))


def validate_forager(config):
    """Raise E-CONFIG for an invalid key or value, and E-MODULATOR for a bad modulator (format 3, ADR 003 D6)."""
    if not isinstance(config, dict):
        _fail("config must be a JSON object")
    unknown = sorted(set(config) - FORAGER_KEYS)
    if unknown:
        _fail(f"unknown key: {unknown[0]}")
    missing = sorted(FORAGER_KEYS - set(config))
    if missing:
        _fail(f"missing key: {missing[0]}")

    if config["formatVersion"] != 3 or config["kind"] != "forager":
        _fail('formatVersion 3 with kind "forager" is required')
    if not isinstance(config["datasetRelease"], str) or not config["datasetRelease"]:
        _fail("datasetRelease must be a non-empty string")
    if config["edgeVariant"] != "traced-only":
        _fail("edgeVariant must be traced-only")

    _check_keys(config["expect"], "expect", EXPECT_KEYS)
    for key in sorted(EXPECT_KEYS):
        if not _is_int(config["expect"][key]) or config["expect"][key] < 0:
            _fail(f"expect.{key} must be an integer ≥ 0")

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

    inputs = config["inputs"]
    if not isinstance(inputs, dict) or not inputs:
        _fail("inputs must be a non-empty object")
    for name, spec in inputs.items():
        if not isinstance(spec, dict):
            _fail(f"inputs.{name} must be an object")
        unknown = sorted(set(spec) - INPUT_KEYS)
        if unknown:
            _fail(f"unknown key in inputs.{name}: {unknown[0]}")
        if not (isinstance(spec.get("class"), str) and spec["class"]):
            _fail(f"inputs.{name}.class must be a non-empty string")
        if spec.get("rootSide") not in ("L", "R"):
            _fail(f'inputs.{name}.rootSide must be "L" or "R"')
        pools = [key for key in ("types", "subclasses", "typePrefixes") if key in spec]
        if not pools:
            _fail(f"inputs.{name} needs types, subclasses or typePrefixes")
        for key in pools:
            if not _is_str_list(spec[key]):
                _fail(f"inputs.{name}.{key} must be a non-empty list of strings")

    side = config["sideMatch"]
    if not (isinstance(side, dict) and set(side) == {"odour", "taste"}
            and isinstance(side["odour"], bool) and isinstance(side["taste"], bool)):
        _fail("sideMatch must be an object with boolean odour and taste")

    outputs = config["outputs"]
    if not isinstance(outputs, dict) or not outputs:
        _fail("outputs must be a non-empty object")
    for name, spec in outputs.items():
        if not isinstance(spec, dict):
            _fail(f"outputs.{name} must be an object")
        unknown = sorted(set(spec) - OUTPUT_KEYS)
        if unknown:
            _fail(f"unknown key in outputs.{name}: {unknown[0]}")
        if not _is_str_list(spec.get("types")):
            _fail(f"outputs.{name}.types must be a non-empty list of strings")
        if spec.get("drive") not in FORAGER_DRIVES:
            _fail(f"outputs.{name}.drive must be one of {', '.join(FORAGER_DRIVES)}")
        if "somaSide" in spec and spec["somaSide"] not in ("L", "R"):
            _fail(f'outputs.{name}.somaSide must be "L" or "R"')

    _check_forager_capabilities(config["capabilities"], inputs, outputs)

    pathways = config["pathways"]
    if not (isinstance(pathways, dict) and set(pathways) == {"odour", "taste"}):
        _fail("pathways must have exactly odour and taste")
    for pathway in ("odour", "taste"):
        if not _is_str_list(pathways[pathway]) or any(pid not in inputs for pid in pathways[pathway]):
            _fail(f"pathways.{pathway} must name declared inputs")

    steps = config["flowSteps"]
    if not _is_int(steps) or not 1 <= steps <= 20:
        _fail("flowSteps must be an integer from 1 to 20")

    budget = config["budget"]
    if not (isinstance(budget, dict) and set(budget) == {"odour", "taste"}
            and all(_is_int(budget[k]) and budget[k] >= 0 for k in ("odour", "taste"))):
        _fail("budget must have non-negative integers odour and taste")

    if not _is_str_list(config["excludeInterneuronClasses"], allow_empty=True):
        _fail("excludeInterneuronClasses must be a list of strings")
    if not isinstance(config["excludeInterneuronSuperclassSuffix"], str):
        _fail("excludeInterneuronSuperclassSuffix must be a string")

    if config["weightRule"] != "postFraction":
        _fail('weightRule must be "postFraction"')
    if config["outputAdmission"] != "low-confidence-sign-zero":
        _fail('outputAdmission must be "low-confidence-sign-zero"')

    _check_modulators(config["modulators"], inputs)

    expected = config["expectedNeuronCount"]
    if expected is not None and (not _is_int(expected) or expected < 3):
        _fail("expectedNeuronCount must be null or an integer ≥ 3")

    bounds = config["neuronCountRange"]
    if not (isinstance(bounds, list) and len(bounds) == 2 and all(_is_int(b) and b >= 0 for b in bounds)
            and bounds[0] <= bounds[1]):
        _fail("neuronCountRange must be [min, max] with min ≤ max")


def load_config(path):
    """Read, parse and validate the config file. Returns the config dict, format 2 or format 3."""
    try:
        with open(path, "r", encoding="utf-8") as handle:
            config = json.load(handle)
    except FileNotFoundError:
        _fail(f"config file not found: {path}")
    except json.JSONDecodeError as error:
        _fail(f"malformed JSON in {path}: {error}")
    if format_of(config) == "forager":
        validate_forager(config)
    else:
        validate(config)
    return config


def config_hash(config):
    """sha256 of the canonical JSON (sorted keys, no whitespace)."""
    canonical = json.dumps(config, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()
