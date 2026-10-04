"""ADR 002 rules: admission (D1, D4), sensory and readouts (D1, D2, D6), interneurons (D3, with
reserved slots from research R3), induced subgraph, signs and weights (D4, D5, D6).

Every rule is a pure function of the admitted bodies and the restricted edge table, so the same
input always gives the same output. Ties break on the smallest bodyId.
"""

import numpy as np

from .errors import ExtractError

SENSORY, LEFT, RIGHT = 0, 1, 2
ROLE_ORDER = ("sensory", "left", "right")
UINT16_MAX = 65535


def admit(annotations, transmitters, config):
    """Return {bodyId: body} for Traced bodies whose transmitter is mapped and confident (D1, D4).

    `annotations` and `transmitters` are iterables of dict rows with the malecns column names.
    """
    signs = {name.lower(): sign for name, sign in config["transmitterSign"].items()}
    threshold = config["minConfidence"]

    annotated = {}
    for row in annotations:
        body = row["bodyId"]
        if body in annotated:
            raise ExtractError("E-DUP-BODY", f"bodyId {body} appears more than once in annotations")
        annotated[body] = row

    transmit = {}
    for row in transmitters:
        body = row["body"]
        if body in transmit:
            raise ExtractError("E-DUP-BODY", f"body {body} appears more than once in neurotransmitters")
        transmit[body] = row

    bodies = {}
    for body, row in annotated.items():
        if row.get("status") != "Traced":
            continue
        neuro = transmit.get(body)
        if neuro is None or neuro.get("predicted_nt_confidence") is None:
            continue
        transmitter = (neuro.get("predicted_nt") or "").lower()
        confidence = float(neuro["predicted_nt_confidence"])
        sign = signs.get(transmitter)
        if sign is None or confidence < threshold:
            continue
        bodies[body] = {
            "class": row.get("class"),
            "superclass": row.get("superclass"),
            "somaSide": row.get("somaSide"),
            "type": row.get("type"),
            "status": row.get("status"),
            "transmitter": transmitter,
            "transmitterConfidence": confidence,
            "sign": sign,
        }
    return bodies


def _check_unique_edges(pre, post):
    if len(pre) < 2:
        return
    order = np.lexsort((post, pre))
    p, q = pre[order], post[order]
    if np.any((p[1:] == p[:-1]) & (q[1:] == q[:-1])):
        raise ExtractError("E-DUP-EDGE", "a (body_pre, body_post) pair appears more than once")


def _pick(candidates, key):
    """Best candidate by `key` (larger is better), ties on smallest bodyId."""
    return max(candidates, key=lambda c: (key(c), -c[0]))


def select_brain(config, bodies, edges):
    """Apply D6 steps 5–8 to the admitted bodies and the restricted edges.

    `edges` is the table (pre, post, synapses): three parallel arrays of bodyIds and raw synapse
    counts. Edges with an end outside `bodies` are ignored. Returns the selected brain in container order: neuron
    indices 0 sensory, 1 LEFT, 2 RIGHT, then interneurons by ascending bodyId.
    """
    if config["maxInterneurons"] < 2:
        raise ExtractError("E-CONFIG", "maxInterneurons must be ≥ 2 (one reserved slot per readout side)")

    ids = np.array(sorted(bodies), dtype=np.int64)
    if ids.size == 0:
        raise ExtractError("E-SENSORY-NONE", "no admitted body to select from")
    pre, post, synapses = edges
    pre = np.asarray(pre, dtype=np.int64)
    post = np.asarray(post, dtype=np.int64)
    syn = np.asarray(synapses, dtype=np.int64)

    keep = np.isin(pre, ids) & np.isin(post, ids)
    pre, post, syn = pre[keep], post[keep], syn[keep]
    _check_unique_edges(pre, post)

    # Dense index of every admitted body: its position in `ids`.
    pre_i = np.searchsorted(ids, pre)
    post_i = np.searchsorted(ids, post)
    count = ids.size
    out_total = np.bincount(pre_i, weights=syn, minlength=count)

    def body(i):
        return bodies[int(ids[i])]

    # D6 step 5: sensory.
    sensory_class = config["sensory"]["class"]
    sensory_status = config["sensory"]["status"]
    alpn = [(i, 0) for i in range(count)
            if body(i)["class"] == sensory_class and body(i)["status"] == sensory_status
            and out_total[i] > 0]
    if not alpn:
        raise ExtractError("E-SENSORY-NONE",
                           f"no admitted {sensory_class} with status {sensory_status} and out-synapses")
    s = _pick([(i, out_total[i]) for i, _ in alpn], key=lambda c: c[1])[0]

    # D6 step 6: readouts, scored by the two-hop sum from the sensory partners.
    from_s = np.bincount(post_i[pre_i == s], weights=syn[pre_i == s], minlength=count)
    partner_edges = from_s[pre_i] > 0
    two_hop = np.bincount(post_i[partner_edges], weights=syn[partner_edges], minlength=count)

    readout_class = config["readouts"]["superclass"]
    readout_status = config["readouts"]["status"]
    readout = {}
    for side in config["readouts"]["somaSides"]:
        candidates = [(i, two_hop[i]) for i in range(count)
                      if body(i)["superclass"] == readout_class and body(i)["status"] == readout_status
                      and body(i)["somaSide"] == side]
        if not candidates:
            raise ExtractError("E-READOUT-NONE",
                               f"no admitted {readout_class} with status {readout_status} on side {side}")
        readout[side] = _pick(candidates, key=lambda c: c[1])[0]
    left, right = readout["L"], readout["R"]
    if left == right or s in (left, right):
        raise ExtractError("E-READOUT-NONE", "sensory and readouts must be three different bodies")

    # D3: interneuron candidates and their reach to the readouts.
    to_left = np.bincount(pre_i[post_i == left], weights=syn[post_i == left], minlength=count)
    to_right = np.bincount(pre_i[post_i == right], weights=syn[post_i == right], minlength=count)
    to_readouts = to_left + to_right
    score = np.minimum(from_s, to_readouts)
    candidates = [i for i in range(count)
                  if i not in (s, left, right) and from_s[i] >= 1 and to_readouts[i] >= 1]

    reach_left = [i for i in candidates if to_left[i] >= 1]
    reach_right = [i for i in candidates if to_right[i] >= 1]
    if not reach_left:
        raise ExtractError("E-NO-PATH", "no interneuron candidate reaches LEFT")
    if not reach_right:
        raise ExtractError("E-NO-PATH", "no interneuron candidate reaches RIGHT")

    def rank(i):
        # Higher score first, then smallest bodyId.
        return (-score[i], int(ids[i]))

    # R3: the best LEFT-reacher and the best RIGHT-reacher are always kept.
    best_left = min(reach_left, key=rank)
    best_right = min(reach_right, key=rank)
    chosen = {best_left, best_right}
    for i in sorted(candidates, key=rank):
        if len(chosen) >= config["maxInterneurons"]:
            break
        chosen.add(i)
    if len(chosen) < config["minInterneurons"]:
        raise ExtractError("E-TOO-FEW",
                           f"{len(chosen)} interneurons selected, minInterneurons is {config['minInterneurons']}")

    interneurons = sorted(chosen, key=lambda i: int(ids[i]))
    order = [s, left, right] + interneurons
    local = np.full(count, -1, dtype=np.int64)
    for k, i in enumerate(order):
        local[i] = k

    # D6 step 8: signs, neurons, induced subgraph and weights.
    neurons = []
    for k, i in enumerate(order):
        b = body(i)
        if b["sign"] not in (1, -1) or b["transmitterConfidence"] < config["minConfidence"]:
            raise ExtractError("E-SIGN", f"body {int(ids[i])} has an unmapped or low-confidence transmitter")
        neurons.append({
            "index": k,
            "role": ROLE_ORDER[k] if k < 3 else "interneuron",
            "bodyId": int(ids[i]),
            "class": b["class"],
            "type": b["type"],
            "somaSide": b["somaSide"],
            "transmitter": b["transmitter"],
            "transmitterConfidence": b["transmitterConfidence"],
            "sign": b["sign"],
        })

    expected = config["expectedNeuronCount"]
    if expected is not None and expected != len(neurons):
        raise ExtractError("E-NODE-COUNT", f"selected {len(neurons)} neurons, expectedNeuronCount is {expected}")

    src_all, dst_all = local[pre_i], local[post_i]
    inside = (src_all >= 0) & (dst_all >= 0) & (syn >= 1)
    src, dst, raw = src_all[inside], dst_all[inside], syn[inside]

    if not np.any(src == SENSORY) or not np.any(dst == LEFT) or not np.any(dst == RIGHT):
        raise ExtractError("E-EMPTY-EDGES", "no edge leaves the sensory neuron or enters LEFT or RIGHT")
    if raw.size and int(raw.max()) > UINT16_MAX:
        raise ExtractError("E-OVERFLOW", f"a synapse count of {int(raw.max())} exceeds {UINT16_MAX}")

    sorting = np.lexsort((dst, src))
    src, dst, raw = src[sorting], dst[sorting], raw[sorting]

    cap = config["synapseCap"]
    sign_of = np.array([n["sign"] for n in neurons], dtype=np.float64)
    weights = (sign_of[src] * np.minimum(raw, cap) / cap).astype(np.float32)

    offsets = np.zeros(len(neurons) + 1, dtype=np.uint32)
    offsets[1:] = np.cumsum(np.bincount(src, minlength=len(neurons)))

    return {
        "neurons": neurons,
        "pre": src.astype(np.uint32),
        "post": dst.astype(np.uint32),
        "offsets": offsets,
        "targets": dst.astype(np.uint32),
        "weights": weights,
        "synapses": raw.astype(np.uint16),
        "edgeCount": int(src.size),
        "readoutInput": {"left": float(two_hop[left]), "right": float(two_hop[right])},
        "reserved": {"left": int(ids[best_left]), "right": int(ids[best_right])},
        "reach": {
            "left": sum(1 for i in interneurons if to_left[i] >= 1),
            "right": sum(1 for i in interneurons if to_right[i] >= 1),
        },
    }
