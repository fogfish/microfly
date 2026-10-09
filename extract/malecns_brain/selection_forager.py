"""Forager selection (ADR 003 D1–D4, W5): input and output pools, side matching, flow ranking with budgets and
exclusions, the induced subgraph, postFraction weights and the neuron order of container version 4.

Every rule is a pure function of the admitted bodies and the restricted edge table, so the same input always gives
the same output. Every sort has an explicit key that ends in bodyId, and every tie breaks on the smallest bodyId.

Choices the ADR leaves open, recorded here and in the run report:
  - Output pools are sinks: their outgoing edges are dropped before the flows are computed, as the induced subgraph
    drops them (D3 step 5), so no flow passes through an output.
  - A body needs a positive flow score to be an interneuron candidate. A body with no path has no reason to be chosen.
  - The sensory exclusion (D3 step 4) is applied to the top-budget union after ranking, so the budget counts those
    bodies and the exclusion removes them (the Annex A counts were measured this way).

ADR 003 D3′ (contracts/extract-config-forager.md P1–P5): each declared `pathwayBias` rule computes a second
backward flow seeded only from the admitted bodies with dataset-resolved sign -1 that have an edge into the rule's
output pool, and combines it with the plain backward flow by elementwise maximum, per pathway — raising a
candidate's score, never lowering it, and never admitting a candidate with zero forward reachability.
"""

import numpy as np

from .errors import ExtractError
from .selection import _check_unique_edges

UINT16_MAX = 65535
ROUND = 6  # decimals for the flow values in the header, so the bytes do not depend on float noise


def _fail(code, message):
    raise ExtractError(code, message)


def _input_order(config):
    return [ch["id"] for ch in config["capabilities"]["channels"]["inputs"]]


def _output_order(config):
    return [ch["id"] for ch in config["capabilities"]["channels"]["outputs"]]


def _matches_input(body, spec):
    """D1: the class and the root side, and one of types, subclasses or type prefixes (any of them)."""
    if body.get("class") != spec["class"] or body.get("rootSide") != spec["rootSide"]:
        return False
    if body.get("type") in spec.get("types", []):
        return True
    if body.get("subclass") in spec.get("subclasses", []):
        return True
    return any((body.get("type") or "").startswith(prefix) for prefix in spec.get("typePrefixes", []))


def _match_sides(inputs, config, bodies, pathway):
    """D1 side matching: per type, keep the first min(|L|, |R|) bodies of each side, by ascending bodyId."""
    ids = config["pathways"][pathway]
    left = [cid for cid in ids if config["inputs"][cid]["rootSide"] == "L"]
    right = [cid for cid in ids if config["inputs"][cid]["rootSide"] == "R"]
    if len(left) != 1 or len(right) != 1:
        _fail("E-CONFIG", f"pathways.{pathway} needs one left and one right input")
    l_id, r_id = left[0], right[0]
    kept_l, kept_r = [], []
    for t in sorted({bodies[b]["type"] for b in inputs[l_id] + inputs[r_id]}):
        ls = [b for b in inputs[l_id] if bodies[b]["type"] == t]
        rs = [b for b in inputs[r_id] if bodies[b]["type"] == t]
        k = min(len(ls), len(rs))
        kept_l += ls[:k]
        kept_r += rs[:k]
    inputs[l_id] = sorted(kept_l)
    inputs[r_id] = sorted(kept_r)


def resolve_pools(config, bodies):
    """Return (inputs, outputs): {channel id: [bodyId, ...]} in declaration order, each list ascending by bodyId.

    Input pools are side-matched for each pathway whose sideMatch is true. The checks are E-POOL-EMPTY (before
    matching, and for an output with no body) and E-SIDE-IMBALANCE (after matching: a side is empty, or a matched
    pair differs in size).
    """
    inputs = {}
    for cid in _input_order(config):
        spec = config["inputs"][cid]
        inputs[cid] = [b for b in sorted(bodies) if _matches_input(bodies[b], spec)]
        if not inputs[cid]:
            _fail("E-POOL-EMPTY", f"input pool {cid} matches no admitted body")

    for pathway in ("odour", "taste"):
        if config["sideMatch"][pathway]:
            _match_sides(inputs, config, bodies, pathway)
        for cid in config["pathways"][pathway]:
            if not inputs[cid]:
                _fail("E-SIDE-IMBALANCE", f"{pathway} pool {cid} is empty after side matching")
        if config["sideMatch"][pathway]:
            left, right = (config["pathways"][pathway][0], config["pathways"][pathway][1])
            if config["inputs"][left]["rootSide"] != "L":
                left, right = right, left
            if len(inputs[left]) != len(inputs[right]):
                _fail("E-SIDE-IMBALANCE",
                      f"{pathway} pools differ in size after side matching: {len(inputs[left])} and {len(inputs[right])}")

    outputs = {}
    for cid in _output_order(config):
        spec = config["outputs"][cid]
        outputs[cid] = [
            b for b in sorted(bodies)
            if bodies[b]["type"] in spec["types"]
            and ("somaSide" not in spec or bodies[b]["somaSide"] == spec["somaSide"])
        ]
        if not outputs[cid]:
            _fail("E-POOL-EMPTY", f"output pool {cid} matches no admitted body")
    return inputs, outputs


def top_by_score(scores, count):
    """The `count` bodies with the largest positive score. Ranking key (−score, bodyId): ties go to the smallest bodyId."""
    ranked = sorted(((body, score) for body, score in scores.items() if score > 0), key=lambda item: (-item[1], item[0]))
    return [body for body, _ in ranked[:count]]


def _flow(read, update, syn, n, seeds, steps):
    """Flow from the seeds, the maximum over steps (D3). x ← min(1, W x), where W[update, read] = syn ÷ Σ syn into update.

    Forward flow: read = presynaptic, update = postsynaptic (W normalised by input synapses of the target).
    Backward flow: read = postsynaptic, update = presynaptic (W normalised by output synapses of the source).
    """
    total = np.bincount(update, weights=syn, minlength=n)
    weight = syn / total[update]
    x = np.zeros(n)
    x[seeds] = 1.0
    best = x.copy()
    for _ in range(steps):
        x = np.minimum(1.0, np.bincount(update, weights=weight * x[read], minlength=n))
        best = np.maximum(best, x)
    return best


def _excluded(body, config):
    """D3 step 4: sensory classes and superclass suffixes never become interneurons."""
    if body.get("class") in config["excludeInterneuronClasses"]:
        return True
    suffix = config["excludeInterneuronSuperclassSuffix"]
    return bool(suffix) and (body.get("superclass") or "").endswith(suffix)


def select_forager(config, bodies, edges):
    """Apply D1–D4 and W5 to the admitted bodies and the restricted edges.

    `edges` is (pre, post, synapses): three parallel arrays of bodyIds and raw synapse counts. Edges with an end outside
    `bodies` are ignored. Returns the brain as a dict: `neurons` (container order, with the channel of each pool
    member), the CSR arrays (`offsets`, `targets`, `weights`, `synapses`), `edgeCount`, and `pools` (channel → neuron
    indices, for the header and the report).
    """
    if not bodies:
        _fail("E-POOL-EMPTY", "no admitted body to select from")
    ids = np.array(sorted(bodies), dtype=np.int64)
    n = len(ids)
    pre, post, syn = (np.asarray(a, dtype=np.int64) for a in edges)
    keep = np.isin(pre, ids) & np.isin(post, ids) & (syn >= 1)
    pre, post, syn = pre[keep], post[keep], syn[keep]
    _check_unique_edges(pre, post)

    inputs, outputs = resolve_pools(config, bodies)
    output_bodies = sorted({b for members in outputs.values() for b in members})
    pool_bodies = {b for members in inputs.values() for b in members} | set(output_bodies)
    memberships = sum(len(m) for m in inputs.values()) + sum(len(m) for m in outputs.values())
    if len(pool_bodies) != memberships:
        _fail("E-CONFIG", "a body is a member of two pools")

    # Output pools are sinks: their outgoing edges go before the flows (see the module notes).
    kept = ~np.isin(pre, np.array(output_bodies, dtype=np.int64))
    pre, post, syn = pre[kept], post[kept], syn[kept]

    pre_i = np.searchsorted(ids, pre)
    post_i = np.searchsorted(ids, post)
    # D4' (ADR 005): every real, admitted presynaptic edge into each body, selected or not — the denominator
    # postFractionAbsolute normalises over, instead of postFraction's selected-only total_in (below).
    total_in_full = np.bincount(post_i, weights=syn, minlength=n)

    def dense(members):
        return np.searchsorted(ids, np.array(members, dtype=np.int64))

    odour_seeds = dense(sorted(b for cid in config["pathways"]["odour"] for b in inputs[cid]))
    taste_seeds = dense(sorted(b for cid in config["pathways"]["taste"] for b in inputs[cid]))
    output_seeds = dense(output_bodies)
    steps = config["flowSteps"]
    f_odour = _flow(pre_i, post_i, syn, n, odour_seeds, steps)
    f_taste = _flow(pre_i, post_i, syn, n, taste_seeds, steps)
    b_flow = _flow(post_i, pre_i, syn, n, output_seeds, steps)

    # D3′: a declared pathwayBias rule's own backward flow, seeded only at the admitted bodies with sign -1 that
    # have an edge into the rule's output pool (P2) — the same restricted pre_i/post_i as b_flow, since the
    # output-outgoing-edge drop above never removes an edge *into* an output (P2/P3).
    sign_of_dense = np.array([bodies[int(b)]["sign"] for b in ids], dtype=np.int64)
    rule_flows = {}
    pathway_rule_ids = {}
    for rule in config["pathwayBias"]:
        into = dense(outputs[rule["intoOutput"]])
        seeds = np.unique(pre_i[np.isin(post_i, into) & (sign_of_dense[pre_i] == -1)])
        rule_flows[rule["id"]] = _flow(post_i, pre_i, syn, n, seeds, steps)
        pathway_rule_ids.setdefault(rule["pathway"], []).append(rule["id"])

    pathway_backward = {}
    for pathway in ("odour", "taste"):
        effective = b_flow
        for rule_id in pathway_rule_ids.get(pathway, []):
            effective = np.maximum(effective, rule_flows[rule_id])
        pathway_backward[pathway] = effective

    score_odour = np.sqrt(f_odour * pathway_backward["odour"])
    score_taste = np.sqrt(f_taste * pathway_backward["taste"])

    # D3 steps 3–4: the budgets, the union, and the exclusion of sensory bodies (interneurons only).
    budget = config["budget"]
    odour_scores = {int(ids[i]): float(score_odour[i]) for i in range(n) if int(ids[i]) not in pool_bodies}
    taste_scores = {int(ids[i]): float(score_taste[i]) for i in range(n) if int(ids[i]) not in pool_bodies}
    odour_admitted = set(top_by_score(odour_scores, budget["odour"]))
    taste_admitted = set(top_by_score(taste_scores, budget["taste"]))
    chosen = odour_admitted | taste_admitted
    interneurons = sorted(b for b in chosen if not _excluded(bodies[b], config))

    # D3′ report data (data-model.md's per-rule report addition): for each declared rule, how many admitted
    # interneurons it boosted (its own flow, not the plain b_flow, is why their effective backward flow is what it
    # is), and of those, how many fall outside the top-budget set plain b_flow alone would have produced.
    pathway_admitted = {"odour": odour_admitted, "taste": taste_admitted}
    plain_score_odour = np.sqrt(f_odour * b_flow)
    plain_score_taste = np.sqrt(f_taste * b_flow)
    plain_scores = {"odour": plain_score_odour, "taste": plain_score_taste}
    plain_admitted = {
        pathway: set(top_by_score(
            {int(ids[i]): float(plain_scores[pathway][i]) for i in range(n) if int(ids[i]) not in pool_bodies},
            budget[pathway],
        ))
        for pathway in ("odour", "taste")
    }
    interneuron_set = set(interneurons)
    pathway_bias_report = []
    for rule in config["pathwayBias"]:
        pathway = rule["pathway"]
        rflow = rule_flows[rule["id"]]
        boosted = [
            int(ids[i]) for i in range(n)
            if int(ids[i]) in pathway_admitted[pathway] and int(ids[i]) in interneuron_set
            and rflow[i] > b_flow[i]
        ]
        admitted_only_by_rule = [b for b in boosted if b not in plain_admitted[pathway]]
        pathway_bias_report.append({
            "id": rule["id"],
            "boosted": len(boosted),
            "admittedOnlyByRule": len(admitted_only_by_rule),
        })

    # Neuron order (W5): input pools in channel order, output pools in declaration order, interneurons by bodyId.
    order = []
    for cid, members in inputs.items():
        order += [(b, "input", cid) for b in members]
    for cid, members in outputs.items():
        order += [(b, "output", cid) for b in members]
    order += [(b, "interneuron", None) for b in interneurons]
    count = len(order)
    lo, hi = config["neuronCountRange"]
    if not lo <= count <= hi:
        _fail("E-NODE-RANGE", f"selected {count} neurons, neuronCountRange is [{lo}, {hi}]")
    expected = config["expectedNeuronCount"]
    if expected is not None and expected != count:
        _fail("E-NODE-COUNT", f"selected {count} neurons, expectedNeuronCount is {expected}")

    local = np.full(n, -1, dtype=np.int64)
    for k, (body, _, _) in enumerate(order):
        local[int(np.searchsorted(ids, body))] = k

    neurons = []
    for k, (body, role, channel) in enumerate(order):
        b = bodies[body]
        dense_i = int(np.searchsorted(ids, body))
        if role != "output" and b["sign"] not in (1, -1):
            _fail("E-SIGN", f"body {body} has an unmapped or low-confidence transmitter")
        neurons.append({
            "index": k,
            "role": role,
            "channel": channel,
            "bodyId": int(body),
            "class": b["class"],
            "type": b["type"],
            "somaSide": b["somaSide"],
            "superclass": b["superclass"],
            "soma": b["soma"],
            "transmitter": b["transmitter"],
            "transmitterConfidence": b["transmitterConfidence"],
            "sign": b["sign"],
            "flowInput": round(float(max(f_odour[dense_i], f_taste[dense_i])), ROUND),
            "flowOutput": round(float(b_flow[dense_i]), ROUND),
        })

    # D3 step 5 and D4: the induced subgraph, then postFraction weights over the selected presynaptic neurons.
    src_all, dst_all = local[pre_i], local[post_i]
    inside = (src_all >= 0) & (dst_all >= 0)
    src, dst, raw = src_all[inside], dst_all[inside], syn[inside]

    for cid, members in outputs.items():
        local_members = {int(local[int(np.searchsorted(ids, b))]) for b in members}
        if not any(int(d) in local_members for d in dst):
            _fail("E-OUTPUT-UNREACHED", f"output pool {cid} receives no edge from the selected neurons")

    if raw.size and int(raw.max()) > UINT16_MAX:
        _fail("E-OVERFLOW", f"a synapse count of {int(raw.max())} exceeds {UINT16_MAX}")

    sorting = np.lexsort((dst, src))
    denom_absolute = total_in_full[post_i[inside]][sorting]
    src, dst, raw = src[sorting], dst[sorting], raw[sorting]
    total_in = np.bincount(dst, weights=raw, minlength=count)
    # D4' (ADR 005): postFractionAbsolute normalises over every real admitted input; postFraction (legacy) keeps
    # normalising over the selected-only total. Either way the selected total is at most the real total, so
    # _check_inflow's "≤ 1" invariant holds under both rules.
    denom = denom_absolute if config["weightRule"] == "postFractionAbsolute" else total_in[dst]
    sign_of = np.array([nr["sign"] for nr in neurons], dtype=np.float64)
    weights = (sign_of[src] * raw / denom).astype(np.float32)

    offsets = np.zeros(count + 1, dtype=np.uint32)
    offsets[1:] = np.cumsum(np.bincount(src, minlength=count))

    pools = {}
    for cid in inputs:
        pools[cid] = [k for k, nr in enumerate(neurons) if nr["channel"] == cid]
    for cid in outputs:
        pools[cid] = [k for k, nr in enumerate(neurons) if nr["channel"] == cid]

    return {
        "neurons": neurons,
        "offsets": offsets,
        "targets": dst.astype(np.uint32),
        "weights": weights,
        "synapses": raw.astype(np.uint16),
        "edgeCount": int(src.size),
        "pools": pools,
        "pathwayBias": pathway_bias_report,
        "pathwayBiasFlow": {
            rule_id: {int(ids[i]): float(flow[i]) for i in range(n)}
            for rule_id, flow in rule_flows.items()
        },
    }
