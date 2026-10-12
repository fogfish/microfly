"""Forager selection, format 4 (ADR 006 D8–D13): six bilateral senses, the pathway × output-group pair grid,
anchors, whole-class exclusions, synapse-count weights and the region taxonomy (L10).

A different algorithm from `selection_forager.py` (v1), not a generalisation of it (research.md R4): v1 ranks one
pooled backward flow against per-pathway budgets; this module scores every (pathway, outputGroup) pair separately
and unions each pair's own top-k. Every rule is a pure function of the admitted bodies and the restricted edge
table; every sort has an explicit key ending in bodyId, and every tie breaks on the smallest bodyId.
"""

import math

import numpy as np

from .errors import ExtractError
from .selection import _check_unique_edges
from .selection_forager import top_by_score

UINT16_MAX = 65535
ROUND = 6  # decimals for the flow values in the header, so the bytes do not depend on float noise

AL_CLASSES = ("ALLN", "ALPN", "ALIN", "ALON")
VNC_SUPERCLASSES = ("vnc_intrinsic", "vnc_motor", "vnc_efferent", "ascending_neuron")
DN_SUPERCLASS = "descending_neuron"


def _fail(code, message):
    raise ExtractError(code, message)


def _input_order(config):
    return [ch["id"] for ch in config["capabilities"]["channels"]["inputs"]]


def _output_order(config):
    return [ch["id"] for ch in config["capabilities"]["channels"]["outputs"]]


def _matches_input(body, spec):
    """D8: AND over class/rootSide/entryNerve (when declared), OR over types/subclasses/typePrefixes (when any
    declared; a filter with none of the three matches on class/rootSide/entryNerve alone, e.g. heat's single type
    is still carried as a one-element `types` list)."""
    if "class" in spec and body.get("class") != spec["class"]:
        return False
    if body.get("rootSide") != spec["rootSide"]:
        return False
    if "entryNerve" in spec and body.get("entryNerve") != spec["entryNerve"]:
        return False
    pool_keys = [key for key in ("types", "subclasses", "typePrefixes") if key in spec]
    if not pool_keys:
        return True
    if "types" in spec and body.get("type") in spec["types"]:
        return True
    if "subclasses" in spec and body.get("subclass") in spec["subclasses"]:
        return True
    if "typePrefixes" in spec and any((body.get("type") or "").startswith(p) for p in spec["typePrefixes"]):
        return True
    return False


def _match_sides(inputs, config, bodies, pathway, member_ids):
    """D8 side matching: per type, keep the first min(|L|, |R|) bodies of each side, by ascending bodyId."""
    left = [cid for cid in member_ids if config["inputs"][cid]["rootSide"] == "L"]
    right = [cid for cid in member_ids if config["inputs"][cid]["rootSide"] == "R"]
    if len(left) != 1 or len(right) != 1:
        _fail("E-CONFIG", f"pathway {pathway} needs exactly one left and one right input for side matching")
    l_id, r_id = left[0], right[0]
    kept_l, kept_r = [], []
    for t in sorted({bodies[b]["type"] for b in inputs[l_id] + inputs[r_id]}, key=lambda t: (t is None, t)):
        ls = [b for b in inputs[l_id] if bodies[b]["type"] == t]
        rs = [b for b in inputs[r_id] if bodies[b]["type"] == t]
        k = min(len(ls), len(rs))
        kept_l += ls[:k]
        kept_r += rs[:k]
    inputs[l_id] = sorted(kept_l)
    inputs[r_id] = sorted(kept_r)


def resolve_pools(config, bodies):
    """Return (inputs, outputs): {channel id: [bodyId, ...]} in declaration order, each list ascending by bodyId.

    D8: side-matched pathways (sideMatch[pathway] true) are matched per type; unmatched pathways keep each side's
    admitted bodies independently. Checks: E-POOL-EMPTY (a channel matches no body), E-SIDE-IMBALANCE (a side
    empty, or a matched pair differs in size after matching), E-POOL-OVERLAP (a body in two channels).
    """
    inputs = {}
    for cid in _input_order(config):
        spec = config["inputs"][cid]
        inputs[cid] = [b for b in sorted(bodies) if _matches_input(bodies[b], spec)]
        if not inputs[cid]:
            _fail("E-POOL-EMPTY", f"input pool {cid} matches no admitted body")

    for pathway, member_ids in config["pathways"].items():
        if config["sideMatch"].get(pathway):
            _match_sides(inputs, config, bodies, pathway, member_ids)
        for cid in member_ids:
            if not inputs[cid]:
                _fail("E-SIDE-IMBALANCE", f"{pathway} pool {cid} is empty after side matching")
        if config["sideMatch"].get(pathway):
            left = next(cid for cid in member_ids if config["inputs"][cid]["rootSide"] == "L")
            right = next(cid for cid in member_ids if config["inputs"][cid]["rootSide"] == "R")
            if len(inputs[left]) != len(inputs[right]):
                _fail("E-SIDE-IMBALANCE",
                      f"{pathway} pools differ in size after side matching: "
                      f"{len(inputs[left])} and {len(inputs[right])}")

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

    owner = {}
    for cid, members in list(inputs.items()) + list(outputs.items()):
        for b in members:
            if b in owner and owner[b] != cid:
                _fail("E-POOL-OVERLAP", f"body {b} matches both {owner[b]} and {cid}")
            owner[b] = cid

    return inputs, outputs


def _flow(read, update, syn, n, seeds, steps):
    """Flow from the seeds, the maximum over steps (ADR 003 D3). x ← min(1, W x), where W[update, read] = syn ÷
    Σ syn into update. Forward flow: read = presynaptic, update = postsynaptic. Backward flow: read =
    postsynaptic, update = presynaptic."""
    total = np.bincount(update, weights=syn, minlength=n)
    weight = syn / total[update]
    x = np.zeros(n)
    x[seeds] = 1.0
    best = x.copy()
    for _ in range(steps):
        x = np.minimum(1.0, np.bincount(update, weights=weight * x[read], minlength=n))
        best = np.maximum(best, x)
    return best


def _signed_flow(read, update, syn, n, seeds, steps, sign):
    """D11 Amendment (BUG-001, ADR 006 Amendment 2026-10-10): a signed variant of `_flow`, used only for an
    output group's backward score. Each hop multiplies by `sign[update]` (the transmitting neuron's resolved
    sign, for that edge's pre-synaptic body), so a path through an even number of inhibitory synapses nets
    positive and an odd one nets negative, instead of `_flow`'s magnitude-only reachability — this is what makes
    `score_{p,o}(i)` reject a candidate whose net contribution to the group is inhibitory, where the unsigned
    `_flow` could not tell the two apart. `read`/`update`/`seeds`/`steps` as `_flow`; `sign` is the dense
    per-neuron sign array ({-1, 0, 1})."""
    total = np.bincount(update, weights=syn, minlength=n)
    weight = syn / total[update]
    x = np.zeros(n)
    x[seeds] = 1.0
    best = x.copy()
    for _ in range(steps):
        x = np.clip(np.bincount(update, weights=weight * x[read] * sign[update], minlength=n), -1.0, 1.0)
        take = np.abs(x) > np.abs(best)
        best = np.where(take, x, best)
    return best


def _excluded(body, config):
    """D12: whole-class and superclass-suffix exclusions never become interneurons."""
    if body.get("class") in config["excludeInterneuronClasses"]:
        return True
    suffix = config.get("excludeInterneuronSuperclassSuffix")
    return bool(suffix) and (body.get("superclass") or "").endswith(suffix)


def region_of(role, body):
    """L10's first-match region taxonomy: input/output pool membership, then class/superclass, else central."""
    if role == "input":
        return "input"
    if role == "output":
        return "output"
    if body.get("class") in AL_CLASSES:
        return "al"
    if body.get("superclass") in VNC_SUPERCLASSES:
        return "vnc"
    if body.get("superclass") == DN_SUPERCLASS:
        return "dn"
    return "central"


def _matches_anchor(body, anchor):
    return all(body.get(key) == value for key, value in anchor.items())


def select_forager_v2(config, bodies, edges):
    """Apply D8–D13 to the admitted bodies and the restricted edges.

    `edges` is (pre, post, synapses): three parallel arrays of bodyIds and raw synapse counts. Returns the brain
    as a dict: `neurons` (container order, each with `region` and `transmitterSource`), the CSR arrays, `edgeCount`
    and `pools` (channel → neuron indices).
    """
    if not bodies:
        _fail("E-POOL-EMPTY", "no admitted body to select from")
    ids = np.array(sorted(bodies), dtype=np.int64)
    n = len(ids)
    sign_dense = np.array([bodies[int(b)].get("sign", 0) for b in ids], dtype=np.float64)
    pre, post, syn = (np.asarray(a, dtype=np.int64) for a in edges)
    min_synapses = config.get("minSynapses", 1)
    keep = np.isin(pre, ids) & np.isin(post, ids) & (syn >= min_synapses)
    pre, post, syn = pre[keep], post[keep], syn[keep]
    _check_unique_edges(pre, post)

    inputs, outputs = resolve_pools(config, bodies)
    output_bodies = sorted({b for members in outputs.values() for b in members})
    pool_bodies = {b for members in inputs.values() for b in members} | set(output_bodies)

    # Output pools are sinks: their outgoing edges go before the flows are computed (D3 step 5 carried over).
    kept = ~np.isin(pre, np.array(output_bodies, dtype=np.int64))
    pre, post, syn = pre[kept], post[kept], syn[kept]

    pre_i = np.searchsorted(ids, pre)
    post_i = np.searchsorted(ids, post)
    total_in_full = np.bincount(post_i, weights=syn, minlength=n)

    # FR-033/SC-013 (BUG-004): each admitted body's real (pre-D11, post-D10/D13) input split by the
    # presynaptic neuron's sign -- the baseline D11's own selection is compared against below, independent of
    # which bodies D11 ends up choosing. `output_body_set`/`input_body_set` mirror resolve_pools' own channel
    # membership so region_of's input/output branches agree with the rest of this function.
    output_body_set = set(output_bodies)
    input_body_set = pool_bodies - output_body_set
    region_all = np.array([
        region_of("input" if int(b) in input_body_set else "output" if int(b) in output_body_set else "other",
                  bodies[int(b)])
        for b in ids
    ])
    real_exc_in = np.bincount(post_i, weights=syn * (sign_dense[pre_i] > 0), minlength=n)
    real_inh_in = np.bincount(post_i, weights=syn * (sign_dense[pre_i] < 0), minlength=n)

    def dense(members):
        return np.searchsorted(ids, np.array(members, dtype=np.int64))

    steps = config["flowSteps"]
    pathway_flow = {}
    for pathway, member_ids in config["pathways"].items():
        seeds = dense(sorted(b for cid in member_ids for b in inputs[cid]))
        pathway_flow[pathway] = _flow(pre_i, post_i, syn, n, seeds, steps)

    group_flow = {}
    signed_group_flow = {}
    for group, member_ids in config["outputGroups"].items():
        seeds = dense(sorted(b for cid in member_ids for b in outputs[cid]))
        group_flow[group] = _flow(post_i, pre_i, syn, n, seeds, steps)
        # D11 Amendment (BUG-001): scoring uses the signed variant so a candidate whose net contribution to
        # the group is inhibitory scores 0, not high — `group_flow` (unsigned) is kept only for the header's
        # informational flowOutput field, unchanged from before this amendment.
        signed_group_flow[group] = _signed_flow(post_i, pre_i, syn, n, seeds, steps, sign_dense)

    budget = config["budget"]["perPair"]
    candidate_i = [i for i in range(n) if int(ids[i]) not in pool_bodies]
    chosen = set()
    for pathway in config["pathways"]:
        for group in config["outputGroups"]:
            fp, bo = pathway_flow[pathway], signed_group_flow[group]
            score = {int(ids[i]): (float(np.sqrt(fp[i] * bo[i])) if bo[i] > 0 else 0.0) for i in candidate_i}
            top = top_by_score(score, budget)
            if not top:
                _fail("E-PAIR-EMPTY", f"pair ({pathway}, {group}) has no candidate with a positive score")
            chosen.update(top)

    anchor_bodies = set()
    for anchor in config["anchors"]:
        matched = [b for b in sorted(bodies) if b not in pool_bodies and _matches_anchor(bodies[b], anchor)]
        if not matched:
            _fail("E-ANCHOR-EMPTY", f"anchor {anchor} matches no admitted body")
        anchor_bodies.update(matched)
    chosen |= anchor_bodies

    # ADR 006 Q7/A7 (BUG-004): D11's pair-grid is a fixed-size top-k per pair, so A4's sign-aware score (BUG-001)
    # does not just exclude net-inhibitory candidates -- it reallocates the same budget toward excitatory ones,
    # thinning recurrent inhibition across the whole selection, not only at `forward`. Unlike `al` (whose
    # dominant inhibitory source, ALLN, is a D12 anchor), `vnc`/`dn`/`central`'s real inhibitory input is spread
    # across hundreds of small cell types with no single class to anchor (measured: `al`'s top inhibitory class
    # is 67.6% of its inhibitory weight; `central`'s is 2.7%) -- a per-neuron closure (each selected body's own
    # top-k missing inhibitory input) was tried and rejected: even one per neuron adds ~11,000 bodies, because
    # almost every admitted neuron's strongest inhibitory partner is distinct. A single *global* top-k hub budget
    # was also tried and rejected: regions differ enormously in how many hub neurons it takes to close their gap
    # (measured: `vnc` overshoots past a 200-neuron global budget while `output` is still under-corrected at
    # 500), so one global ranking over- and under-shoots different regions at the same time. `inhibitoryClosure`
    # is keyed per L10 region instead: for each named region, rank real-admitted inhibitory candidates by how
    # much synapse weight they deliver specifically into that region's already-selected targets (D11 candidates,
    # anchors, and the fixed input/output pools), and admit that region's own declared top-k, unconditionally.
    closure = config.get("inhibitoryClosure", {})
    if closure:
        selected_dense = np.fromiter((int(np.searchsorted(ids, b)) for b in (chosen | pool_bodies)), dtype=np.int64)
        selected_mask = np.zeros(n, dtype=bool)
        selected_mask[selected_dense] = True
        closure_bodies = set()
        for region, region_budget in closure.items():
            if region_budget <= 0:
                continue
            target_in_region = selected_mask & (region_all == region)
            inh_into_region = (sign_dense[pre_i] < 0) & target_in_region[post_i]
            contribution = np.bincount(pre_i[inh_into_region], weights=syn[inh_into_region], minlength=n)
            candidate_i = np.where(~selected_mask & (contribution > 0))[0]
            ranked = sorted(candidate_i.tolist(), key=lambda i: (-contribution[i], int(ids[i])))
            picked = 0
            for i in ranked:
                if picked >= region_budget:
                    break
                body = int(ids[i])
                if body in closure_bodies or _excluded(bodies[body], config):
                    continue
                closure_bodies.add(body)
                picked += 1
        chosen |= closure_bodies

    interneurons = sorted(b for b in chosen if b not in pool_bodies and not _excluded(bodies[b], config))

    # Neuron order (container v5): input pools in channel order, output pools in declaration order, interneurons
    # by bodyId.
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

    local = np.full(n, -1, dtype=np.int64)
    for k, (body, _, _) in enumerate(order):
        local[int(np.searchsorted(ids, body))] = k

    f_max = {}
    for i in candidate_i:
        f_max[int(ids[i])] = max(pathway_flow[p][i] for p in pathway_flow)
    b_max = {}
    for i in candidate_i:
        b_max[int(ids[i])] = max(group_flow[g][i] for g in group_flow)

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
            "transmitterSource": b["transmitterSource"],
            "transmitterConfidence": b["transmitterConfidence"],
            "sign": b["sign"],
            "group": region_of(role, b),
            "flowInput": round(float(f_max.get(body, 0.0)), ROUND),
            "flowOutput": round(float(b_max.get(body, 0.0)), ROUND),
        })

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
    sign_of = np.array([nr["sign"] for nr in neurons], dtype=np.float64)

    weight_rule = config["weightRule"]
    if weight_rule == "synapseCount":
        weights = (sign_of[src] * raw).astype(np.float32)
    else:
        total_in = np.bincount(dst, weights=raw, minlength=count)
        denom = denom_absolute if weight_rule == "postFractionAbsolute" else total_in[dst]
        weights = (sign_of[src] * raw / denom).astype(np.float32)

    offsets = np.zeros(count + 1, dtype=np.uint32)
    offsets[1:] = np.cumsum(np.bincount(src, minlength=count))

    # FR-032/SC-012 (BUG-001): every output pool's admitted net synaptic weight per neuron must be positive --
    # a pool that is net inhibitory or net zero can never drive its drive upward at any LIF setting (the root
    # cause BUG-001 found for `forward`). Checked here, on the final CSR weights, after D13's sign * synapses.
    output_net_weight = {}
    for cid, members in outputs.items():
        local_members = np.array(
            sorted(int(local[int(np.searchsorted(ids, b))]) for b in members), dtype=np.int64)
        per_neuron = float(weights[np.isin(dst, local_members)].sum()) / len(local_members)
        output_net_weight[cid] = round(per_neuron, ROUND)
        if per_neuron <= 0:
            _fail("E-OUTPUT-SIGN",
                  f"output pool {cid} has non-positive net admitted synaptic weight per neuron "
                  f"({per_neuron:.3f})")

    # FR-033/SC-013 (BUG-004): A4's sign-aware D11 score (BUG-001 Amendment) was found to thin recurrent
    # inhibition network-wide, not only at `forward` -- undetectable by the FR-032 check above, which is
    # per-output-pool and sign-only. Compare each L10 region's selected inhibitory/excitatory *synapse-count*
    # ratio (not `weights`, so the comparison is independent of `weightRule`) against the same ratio over the
    # region's real admitted input (`real_exc_in`/`real_inh_in`, computed above before D11 narrows anything);
    # stop extraction, named, when any region drifts past the declared tolerance.
    group_of_final = np.array([nr["group"] for nr in neurons])
    tgt_group = group_of_final[dst]
    sign_src = sign_of[src]
    ie_tolerance = config.get("ieDriftTolerance", {})
    inhibition_coverage = {}
    for region in sorted(set(region_all.tolist()) | set(group_of_final.tolist())):
        real_exc = float(real_exc_in[region_all == region].sum())
        real_inh = float(real_inh_in[region_all == region].sum())
        region_mask = tgt_group == region
        sel_exc = float(raw[region_mask & (sign_src > 0)].sum())
        sel_inh = float(raw[region_mask & (sign_src < 0)].sum())
        if real_exc <= 0 or (sel_exc + sel_inh) <= 0:
            continue  # no real baseline, or nothing selected here, to compare
        real_ratio = real_inh / real_exc
        sel_ratio = sel_inh / sel_exc if sel_exc > 0 else math.inf
        drift = abs(sel_ratio - real_ratio)
        inhibition_coverage[region] = {"real": round(real_ratio, ROUND),
                                        "selected": round(sel_ratio, ROUND) if math.isfinite(sel_ratio) else None}
        region_tolerance = ie_tolerance.get(region)
        if region_tolerance is not None and drift > region_tolerance:
            _fail("E-INHIBITION-DRIFT",
                  f"region {region} has selected inhibitory/excitatory ratio "
                  f"{'inf' if not math.isfinite(sel_ratio) else f'{sel_ratio:.3f}'} vs. real-admitted "
                  f"{real_ratio:.3f} (drift {drift:.3f} exceeds ieDriftTolerance.{region} {region_tolerance})")

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
        "outputNetWeight": output_net_weight,
        "inhibitionCoverage": inhibition_coverage,
        "edgeCount": int(src.size),
        "pools": pools,
    }
