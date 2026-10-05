"""Brain container, version 3 (specs/006-fly-status-panel/contracts/snapshot-format-v3.md).

Layout: "MFBR", formatVersion (uint32), header length H (uint32, multiple of 8),
UTF-8 JSON header padded with spaces, then the CSR sections offsets, targets,
weights, synapses. All integers and floats are little-endian. Version 3 adds the
required `capabilities` header block. Version 2 is read only by the migration tool.
"""

import json
import os
import tempfile

import numpy as np

from .capabilities import validate_capabilities

MAGIC = b"MFBR"
FORMAT_VERSION = 3
LEGACY_VERSION = 2
PREFIX = 12
ROLES = ("sensory", "left", "right")

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

    `header` carries provenance, synapseCap, neuronCount, edgeCount, neurons and capabilities;
    its `sections` entry is computed here. Returns the number of bytes written.
    """
    offsets = np.asarray(offsets, dtype=DTYPES["offsets"])
    targets = np.asarray(targets, dtype=DTYPES["targets"])
    weights = np.asarray(weights, dtype=DTYPES["weights"])
    synapses = np.asarray(synapses, dtype=DTYPES["synapses"])

    neuron_count = len(offsets) - 1
    edge_count = len(targets)
    if header["neuronCount"] != neuron_count or header["edgeCount"] != edge_count:
        raise ValueError("header counts do not match the arrays")
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

    prefix = MAGIC + FORMAT_VERSION.to_bytes(4, "little") + header_length.to_bytes(4, "little")
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


def read_container(data, version=FORMAT_VERSION):
    """Parse and check a container (rules 1–7 of snapshot-format.md, rules 8–18 of v3).

    `version` is FORMAT_VERSION for every reader except the migration, which passes LEGACY_VERSION.
    A legacy file has no capabilities block, so the capability rules are skipped for it.
    Returns a dict with `header`, `neuronCount`, `edgeCount` and the four CSR arrays.
    Raises ValueError with the exact message of the contract.
    """
    if len(data) < PREFIX or data[:4] != MAGIC:
        _reject("not a brain snapshot")

    found = int.from_bytes(data[4:8], "little")
    if found != version:
        _reject(f"unsupported snapshot version {found}; this build supports {version}")

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
    if not roles_ok:
        _reject("snapshot roles out of order: expected sensory, left, right")

    for index, neuron in enumerate(neurons):
        soma = neuron.get("soma")
        if soma is not None and not _is_position(soma):
            _reject(f"snapshot neuron {index} has a malformed soma position")
        superclass = neuron.get("superclass")
        if superclass is not None and not isinstance(superclass, str):
            _reject(f"snapshot neuron {index} has a malformed superclass")

    if version == FORMAT_VERSION:
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

    return {
        "header": header,
        "neuronCount": neuron_count,
        "edgeCount": edge_count,
        "offsets": offsets,
        "targets": targets,
        "weights": weights,
        "synapses": synapses,
    }
