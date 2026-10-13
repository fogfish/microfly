"""Forager admission (ADR 003 D2 and D1): the ADR 002 rule for every body, plus the output admission rule.

Inputs and interneurons keep ADR 002 D4 unchanged: a Traced body with a mapped, confident transmitter. The rule is
called from selection.admit and not copied here. An output pool body is admitted whatever its transmitter: an
unmapped or low-confidence transmitter gives sign 0, and its outgoing edges are dropped later (selection_forager).

`admit_all_traced` (ADR 006 D10, contracts/extract-config-classseed.md) is a different rule entirely: every Traced
body is admitted regardless of transmitter confidence, and sign comes from a configured transmitter column
(`transmitterColumn`) through `transmitterSign`/`defaultSign`, not from the ADR 002 confidence gate.
"""

from .errors import ExtractError
from .selection import _soma, admit


def admit_forager(annotations, transmitters, config, pool_types):
    """Return {bodyId: body} for the forager brain.

    `annotations` and `transmitters` are iterables of dict rows with the malecns column names (the forager columns
    of dataset.FORAGER_ANNOTATION_COLUMNS). `pool_types` is the set of types of the output pools. Every admitted body
    carries rootSide, subclass and receptorType for the pool filters.

    When config["admission"] is "allTraced" (ADR 006 Gate C arm 3, forager-brain-v1-rules.json: the flow-ranked
    strategy's own pools/budgets, with D10 admission instead of the ADR 002 rule), every body already gets a
    sign from admit_all_traced, so the output-pool sign-0 exception below does not apply and is skipped entirely.
    """
    if config.get("admission") == "allTraced":
        return admit_all_traced(annotations, transmitters, config)
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


def admit_all_traced(annotations, transmitters, config):
    """Return {bodyId: body} for every Traced body (ADR 006 D10): no confidence gate, no dropped population.

    `annotations` is an iterable of dict rows with the malecns column names. `transmitters` is an iterable of
    {"body": ..., transmitterColumn: ...} rows (dataset.load_neurotransmitter_table, which raises
    E-TRANSMITTER-COLUMN if the configured column does not exist on the dataset). Sign comes from
    config["transmitterSign"] applied to the transmitterColumn value, lowercased, or config["defaultSign"] for
    every other value (including null/unclear). Each body records `transmitter`, the raw column value, which
    `sign` traces back to (constitution III).
    """
    column = config["transmitterColumn"]
    sign_of = {name.lower(): sign for name, sign in config["transmitterSign"].items()}
    default_sign = config["defaultSign"]

    transmit = {}
    for row in transmitters:
        body = row["body"]
        if body in transmit:
            raise ExtractError("E-DUP-BODY", f"body {body} appears more than once in neurotransmitters")
        transmit[body] = row

    bodies = {}
    for row in annotations:
        if row.get("status") != "Traced":
            continue
        body = row["bodyId"]
        value = transmit.get(body, {}).get(column)
        transmitter = value if isinstance(value, str) and value else None
        sign = sign_of.get(transmitter.lower(), default_sign) if transmitter else default_sign
        bodies[body] = {
            "class": row.get("class"),
            "superclass": row.get("superclass"),
            "somaSide": row.get("somaSide"),
            "soma": _soma(row.get("somaLocation")),
            "type": row.get("type"),
            "status": row.get("status"),
            "transmitter": transmitter,
            "sign": sign,
            **_pool_fields(row),
        }
    return bodies

