"""Forager admission (ADR 003 D2 and D1): the ADR 002 rule for every body, plus the output admission rule.

Inputs and interneurons keep ADR 002 D4 unchanged: a Traced body with a mapped, confident transmitter. The rule is
called from selection.admit and not copied here. An output pool body is admitted whatever its transmitter: an
unmapped or low-confidence transmitter gives sign 0, and its outgoing edges are dropped later (selection_forager).
"""

from .errors import ExtractError
from .selection import _soma, admit


def admit_forager(annotations, transmitters, config, pool_types):
    """Return {bodyId: body} for the forager brain.

    `annotations` and `transmitters` are iterables of dict rows with the malecns column names (the forager columns
    of dataset.FORAGER_ANNOTATION_COLUMNS). `pool_types` is the set of types of the output pools. Every admitted body
    carries rootSide, subclass and receptorType for the pool filters.
    """
    rows = list(annotations)
    transmitters = list(transmitters)
    bodies = admit(rows, transmitters, config)

    transmit = {}
    for row in transmitters:
        body = row["body"]
        if body in transmit:
            raise ExtractError("E-DUP-BODY", f"body {body} appears more than once in neurotransmitters")
        transmit[body] = row

    for row in rows:
        body = row["bodyId"]
        if body in bodies:
            bodies[body].update(_pool_fields(row))
            continue
        # The output rule: a Traced output body needs incoming edges only, so its transmitter may be unmapped.
        if row.get("status") != "Traced" or row.get("type") not in pool_types:
            continue
        neuro = transmit.get(body, {})
        transmitter = (neuro.get("predicted_nt") or "").lower()
        confidence = neuro.get("predicted_nt_confidence")
        bodies[body] = {
            "class": row.get("class"),
            "superclass": row.get("superclass"),
            "somaSide": row.get("somaSide"),
            "soma": _soma(row.get("somaLocation")),
            "type": row.get("type"),
            "status": row.get("status"),
            "transmitter": transmitter,
            "transmitterConfidence": float(confidence) if confidence is not None else 0.0,
            "sign": 0,
            **_pool_fields(row),
        }
    return bodies


def _pool_fields(row):
    return {
        "rootSide": row.get("rootSide"),
        "subclass": row.get("subclass"),
        "receptorType": row.get("receptorType"),
    }


def resolve_transmitter_sign(row, source_order, sign_table, min_confidence):
    """ADR 006 D10: walk `source_order` and return (sign, column) for the first column naming a transmitter
    `sign_table` maps. `predicted_nt` keeps its `min_confidence` test; `ground_truth`/`consensus_nt` carry none.
    `row` is a neurotransmitter-table row (or {} when the body has none). Returns (None, None) when no column
    resolves a sign.
    """
    for column in source_order:
        value = row.get(column)
        if not value:
            continue
        sign = sign_table.get(value.lower())
        if sign is None:
            continue
        if column == "predicted_nt":
            confidence = row.get("predicted_nt_confidence")
            if confidence is None or float(confidence) < min_confidence:
                continue
        return sign, column
    return None, None


def admit_forager_v2(annotations, transmitters, config, pool_types):
    """Return {bodyId: body} for the ADR 006 forager brain (format 4).

    D10's transmitter-source fallback (`resolve_transmitter_sign`) replaces the `predicted_nt`-only rule for every
    body, input or interneuron candidate alike (their outgoing synapses are signed, so they need a resolved sign).
    The ADR 003 output rule is unchanged: a Traced body of an output pool's type is admitted with sign 0 when no
    column resolves a sign (its outgoing edges are dropped later, selection_forager_v2). `pool_types` is the set of
    types of the output pools, as `admit_forager` already takes it.
    """
    rows = list(annotations)
    transmitters = list(transmitters)

    transmit = {}
    for row in transmitters:
        body = row["body"]
        if body in transmit:
            raise ExtractError("E-DUP-BODY", f"body {body} appears more than once in neurotransmitters")
        transmit[body] = row

    signs = {name.lower(): sign for name, sign in config["transmitterSign"].items()}
    source_order = config["transmitterSource"]
    min_confidence = config["minConfidence"]

    bodies = {}
    for row in rows:
        body = row["bodyId"]
        if row.get("status") != "Traced":
            continue
        neuro = transmit.get(body, {})
        sign, source = resolve_transmitter_sign(neuro, source_order, signs, min_confidence)
        if sign is None:
            if row.get("type") not in pool_types:
                continue
            sign, source = 0, source_order[-1]
        confidence = neuro.get("predicted_nt_confidence")
        bodies[body] = {
            "class": row.get("class"),
            "superclass": row.get("superclass"),
            "somaSide": row.get("somaSide"),
            "soma": _soma(row.get("somaLocation")),
            "type": row.get("type"),
            "status": row.get("status"),
            "transmitter": (neuro.get(source) or "").lower(),
            "transmitterSource": source,
            "transmitterConfidence": float(confidence) if confidence is not None else 0.0,
            "sign": sign,
            **_pool_fields(row),
            "entryNerve": row.get("entryNerve"),
        }
    return bodies

