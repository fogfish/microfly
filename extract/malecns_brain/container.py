"""Brain container, versions 3 and 4 (specs/006-fly-status-panel/contracts/snapshot-format-v3.md and
specs/008-hungry-forager-brain/contracts/container-v4.md).

Layout: "MFBR", formatVersion (uint32), header length H (uint32, multiple of 8),
UTF-8 JSON header padded with spaces, then the CSR sections offsets, targets,
weights, synapses. All integers and floats are little-endian. Version 3 adds the
required `capabilities` header block (the small brain). Version 4 is the forager brain: the header
has `kind`, `weightRule`, `synapseCap`, `modulators`, and pool channels. Version 2 is read only by the migration tool.
A writer chooses version 4 when the header has `kind`, and version 3 otherwise.
"""

import json
import os
import re
import tempfile

import numpy as np

from .capabilities import validate_capabilities, validate_capabilities_v4

MAGIC = b"MFBR"
FORMAT_VERSION = 3
FORMAT_VERSION_V4 = 4
SUPPORTED_VERSIONS = (FORMAT_VERSION, FORMAT_VERSION_V4)
LEGACY_VERSION = 2
PREFIX = 12
ROLES = ("sensory", "left", "right")
ROLE_MESSAGE = "snapshot roles out of order: expected inputs, outputs, then interneurons"
SIGNS_V4 = (-1, 0, 1)
WEIGHT_TOLERANCE = 1e-6
MODULATOR_ID = re.compile(r"[a-z][a-z0-9-]*")

DTYPES = {
    "offsets": np.dtype("<u4"),
    "targets": np.dtype("<u4"),
    "weights": np.dtype("<f4"),
    "synapses": np.dtype("<u2"),
}


def _align4(value):
    return (value + 3) & ~3


def _pad8(value):
    return (value + 7) & ~7


def _encode_header(header):
    return json.dumps(header, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def _section_table(header_length, neuron_count, edge_count):
    """Absolute byte offsets and lengths of the four sections, in file order."""
    cursor = PREFIX + header_length
    lengths = {
        "offsets": 4 * (neuron_count + 1),
        "targets": 4 * edge_count,
        "weights": 4 * edge_count,
        "synapses": 2 * edge_count,
    }
    table = {}
    for name in ("offsets", "targets", "weights", "synapses"):
        table[name] = {"byteOffset": cursor, "byteLength": lengths[name]}
        cursor = _align4(cursor + lengths[name])
    return table, cursor


def write_container(path, header, offsets, targets, weights, synapses):
    """Write the container to a temporary file in the same directory, then rename it.

    `header` carries provenance, synapseCap, neuronCount, edgeCount, neurons and capabilities; a version 4
    header also carries kind, weightRule and modulators. Its `sections` entry is computed here. The version is 4
    when the header has `kind`. Returns the number of bytes written.
    """
    offsets = np.asarray(offsets, dtype=DTYPES["offsets"])
    targets = np.asarray(targets, dtype=DTYPES["targets"])
    weights = np.asarray(weights, dtype=DTYPES["weights"])
    synapses = np.asarray(synapses, dtype=DTYPES["synapses"])

    neuron_count = len(offsets) - 1
    edge_count = len(targets)
    if header["neuronCount"] != neuron_count or header["edgeCount"] != edge_count:
        raise ValueError("header counts do not match the arrays")
    version = FORMAT_VERSION_V4 if "kind" in header else FORMAT_VERSION
    if version == FORMAT_VERSION_V4:
        _check_forager(header, neuron_count)
        _check_inflow(targets, weights, neuron_count)
    else:
        validate_capabilities(header.get("capabilities"), neuron_count)

    # The header holds the section offsets, which depend on the header length.
    # Iterate until the padded length is stable; it only grows, so this ends.
    header_length = 0
    while True:
        table, end = _section_table(header_length, neuron_count, edge_count)
        document = dict(header, sections=table)
        encoded = _encode_header(document)
        padded = _pad8(len(encoded))
        if padded == header_length:
            break
        header_length = padded
    encoded = encoded + b" " * (header_length - len(encoded))

    body = bytearray()
    body += offsets.tobytes()
    body += targets.tobytes()
    body += weights.tobytes()
    body += synapses.tobytes()
    body += b"\x00" * (end - PREFIX - header_length - len(body))

    prefix = MAGIC + version.to_bytes(4, "little") + header_length.to_bytes(4, "little")
    data = prefix + encoded + bytes(body)

    directory = os.path.dirname(os.path.abspath(path))
    handle, temporary = tempfile.mkstemp(dir=directory, prefix=".brain-", suffix=".tmp")
    try:
        with os.fdopen(handle, "wb") as out:
            out.write(data)
        os.chmod(temporary, 0o644)
        os.replace(temporary, path)
    except BaseException:
        if os.path.exists(temporary):
            os.unlink(temporary)
        raise
    return len(data)


def _reject(message):
    raise ValueError(message)


def _is_position(value):
    """True for a list of exactly three ints (bools are not ints here)."""
    return (isinstance(value, list) and len(value) == 3
            and all(isinstance(v, int) and not isinstance(v, bool) for v in value))


def _check_position(neuron, index):
    soma = neuron.get("soma")
    if soma is not None and not _is_position(soma):
        _reject(f"snapshot neuron {index} has a malformed soma position")
    superclass = neuron.get("superclass")
    if superclass is not None and not isinstance(superclass, str):
        _reject(f"snapshot neuron {index} has a malformed superclass")


def _check_modulators(modulators, input_ids):
    """Rules M1–M3 of container-v4.md. The messages match public/js/brain/snapshot.js."""
    if not isinstance(modulators, list):
        _reject("snapshot modulators are malformed")
    earlier = set()
    for mod in modulators:
        mid = mod.get("id") if isinstance(mod, dict) else None
        if not (isinstance(mid, str) and MODULATOR_ID.fullmatch(mid)):
            _reject(f"snapshot modulator {mid} has a malformed id")
        label = mod.get("label")
        if not (isinstance(label, str) and 0 < len(label) <= 40):
            _reject(f"snapshot modulator {mid} has a malformed label")
        targets = mod.get("targets")
        if not (isinstance(targets, list) and targets):
            _reject(f"snapshot modulator {mid} has no targets")
        for target in targets:
            if target not in input_ids:
                _reject(f"snapshot modulator {mid} targets an undeclared input {target}")
        gain = mod.get("gain")
        if not (isinstance(gain, list) and len(gain) == 2
                and all(isinstance(g, (int, float)) and not isinstance(g, bool) and g >= 0 for g in gain)):
            _reject(f"snapshot modulator {mid} has a gain that is not two numbers of 0 or more")
        has_range, has_source = "range" in mod, "source" in mod
        if has_range == has_source:
            _reject(f"snapshot modulator {mid} needs either range or source")
        if has_range and mod["range"] != [0, 1]:
            _reject(f"snapshot modulator {mid} has a range that is not [0, 1]")
        if has_source and mod["source"] not in earlier:
            _reject(f"snapshot modulator {mid} has source {mod['source']} that is not an earlier modulator")
        earlier.add(mid)


def _check_forager(header, neuron_count):
    """Version 4 header rules: kind, weight rule, synapse cap, the v4 declaration, roles and signs (N1–N4), and the
    modulators (M1–M3). The messages match public/js/brain/snapshot.js."""
    if header.get("kind") != "forager":
        _reject(f'snapshot kind "{header.get("kind")}" is not supported')
    if header.get("weightRule") != "postFraction":
        _reject(f'snapshot weight rule "{header.get("weightRule")}" is not supported')
    cap = header.get("synapseCap")
    if not (isinstance(cap, int) and not isinstance(cap, bool) and 1 <= cap <= 65535):
        _reject("snapshot synapseCap must be an integer from 1 to 65535")
    try:
        validate_capabilities_v4(header.get("capabilities"), neuron_count, "forager")
    except ValueError as error:
        _reject(str(error))

    declaration = header["capabilities"]["channels"]
    inputs, outputs = declaration["inputs"], declaration["outputs"]
    pool_of = {}
    for channel in inputs:
        for n in channel["neurons"]:
            pool_of[n] = ("input", channel["id"])
    for channel in outputs:
        for n in channel["neurons"]:
            pool_of[n] = ("output", channel["id"])
    n_in = sum(len(ch["neurons"]) for ch in inputs)
    n_out = sum(len(ch["neurons"]) for ch in outputs)

    neurons = header.get("neurons")
    if not (isinstance(neurons, list) and len(neurons) == neuron_count):
        _reject(ROLE_MESSAGE)
    for index, neuron in enumerate(neurons):
        if not isinstance(neuron, dict) or neuron.get("index") != index:
            found = neuron.get("index") if isinstance(neuron, dict) else None
            _reject(f"snapshot neuron index {found} is not its position {index}")
        expected_role = "input" if index < n_in else "output" if index < n_in + n_out else "interneuron"
        if neuron.get("role") != expected_role:
            _reject(ROLE_MESSAGE)
        if index in pool_of:
            kind, channel_id = pool_of[index]
            if neuron.get("channel") != channel_id or kind != expected_role:
                _reject(f"snapshot neuron {index} is not in channel {neuron.get('channel')}")
        elif neuron.get("channel") is not None:
            _reject(f"snapshot neuron {index} is not in channel {neuron.get('channel')}")
        sign = neuron.get("sign")
        if sign not in SIGNS_V4:
            _reject(f"snapshot neuron {index} has sign {sign}; expected -1, 0 or 1")
        if sign == 0 and neuron.get("role") != "output":
            _reject(f"snapshot neuron {index} has sign 0 but is not an output")
        _check_position(neuron, index)

    _check_modulators(header.get("modulators"), {ch["id"] for ch in inputs})


def _check_inflow(targets, weights, neuron_count):
    """postFraction (ADR 003 D4): the absolute input weights of each neuron sum to at most 1."""
    if len(targets) == 0:
        return
    inflow = np.zeros(neuron_count, dtype=np.float64)
    np.add.at(inflow, targets.astype(np.int64), np.abs(weights.astype(np.float64)))
    if np.any(inflow > 1.0 + WEIGHT_TOLERANCE):
        _reject("snapshot CSR is inconsistent: input weights into a neuron exceed 1 in absolute sum")


def read_container(data, version=None):
    """Parse and check a container (rules 1–7 of snapshot-format.md, rules 8–18 of v3, and the version 4 rules).

    With no `version`, versions 3 and 4 are read. The migration passes LEGACY_VERSION (2), and then only that version
    is read. A legacy file has no capabilities block, so the capability rules are skipped for it.
    Returns a dict with `header`, `neuronCount`, `edgeCount` and the four CSR arrays.
    Raises ValueError with the exact message of the contract.
    """
    if len(data) < PREFIX or data[:4] != MAGIC:
        _reject("not a brain snapshot")

    found = int.from_bytes(data[4:8], "little")
    accepted = SUPPORTED_VERSIONS if version is None else (version,)
    if found not in accepted:
        listed = " and ".join(str(v) for v in accepted)
        _reject(f"unsupported snapshot version {found}; this build supports {listed}")

    header_length = int.from_bytes(data[8:12], "little")
    if header_length % 8 != 0 or PREFIX + header_length > len(data):
        _reject("snapshot header is truncated")

    try:
        header = json.loads(data[PREFIX:PREFIX + header_length].decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        _reject("snapshot header is not valid JSON")
    if not isinstance(header, dict):
        _reject("snapshot header is not valid JSON")

    neuron_count = header.get("neuronCount")
    edge_count = header.get("edgeCount")
    neurons = header.get("neurons")
    roles_ok = (
        isinstance(neuron_count, int) and isinstance(edge_count, int)
        and isinstance(neurons, list) and len(neurons) == neuron_count
        and neuron_count >= 3
    )
    if roles_ok:
        for index, neuron in enumerate(neurons):
            if not isinstance(neuron, dict) or neuron.get("index") != index:
                roles_ok = False
                break
        if roles_ok:
            roles_ok = [neurons[i].get("role") for i in range(3)] == list(ROLES)
    if found == FORMAT_VERSION_V4:
        _check_forager(header, neuron_count)
    else:
        if not roles_ok:
            _reject("snapshot roles out of order: expected sensory, left, right")
        for index, neuron in enumerate(neurons):
            _check_position(neuron, index)
        if found == FORMAT_VERSION:
            validate_capabilities(header.get("capabilities"), neuron_count)

    expected, end = _section_table(header_length, neuron_count, edge_count)
    sections = header.get("sections")
    if not isinstance(sections, dict):
        _reject("snapshot section sections is out of bounds")
    for name in ("offsets", "targets", "weights", "synapses"):
        section = sections.get(name)
        if not isinstance(section, dict) or section != expected[name]:
            _reject(f"snapshot section {name} is out of bounds")
        start = section["byteOffset"]
        if start % 4 != 0 or start + section["byteLength"] > len(data):
            _reject(f"snapshot section {name} is out of bounds")
    if len(data) != end:
        _reject("snapshot section synapses is out of bounds")

    arrays = {}
    for name in ("offsets", "targets", "weights", "synapses"):
        section = expected[name]
        arrays[name] = np.frombuffer(
            data, dtype=DTYPES[name], count=section["byteLength"] // DTYPES[name].itemsize,
            offset=section["byteOffset"],
        )

    offsets, targets, weights, synapses = (
        arrays["offsets"], arrays["targets"], arrays["weights"], arrays["synapses"]
    )
    if offsets[0] != 0 or offsets[-1] != edge_count or np.any(np.diff(offsets.astype(np.int64)) < 0):
        _reject("snapshot CSR is inconsistent: offsets must start at 0, not decrease and end at edgeCount")
    if edge_count and int(targets.max()) >= neuron_count:
        _reject("snapshot CSR is inconsistent: a target is outside neuronCount")
    if edge_count and (int(synapses.min()) < 1):
        _reject("snapshot CSR is inconsistent: a synapse count is 0")
    if not np.all(np.isfinite(weights)):
        _reject("snapshot CSR is inconsistent: a weight is not finite")
    if found == FORMAT_VERSION_V4:
        _check_inflow(targets, weights, neuron_count)

    return {
        "version": found,
        "kind": header.get("kind"),
        "modulators": header.get("modulators", []),
        "header": header,
        "neuronCount": neuron_count,
        "edgeCount": edge_count,
        "offsets": offsets,
        "targets": targets,
        "weights": weights,
        "synapses": synapses,
    }
