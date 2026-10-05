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

