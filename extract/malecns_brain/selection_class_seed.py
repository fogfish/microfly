"""Class-seeded forager selection (ADR 006 D8-D13, contracts/extract-config-classseed.md): whole-class seeds, a
shared-synapse-weight fill to one declared total, allTraced admission (signs from admission.admit_all_traced),
the minSynapses edge threshold, postFractionAbsolute weights over the thresholded allTraced-admitted graph, and
the linear extraction-fidelity probe run before the container is written.

Every rule is a pure function of the admitted bodies and the restricted edge table, so the same input always
gives the same output. Every sort has an explicit key that ends in bodyId, and every tie breaks on the smallest
bodyId. No pathway, flow or per-output score is computed here (lesson 2, ADR 006 Context) — that is
selection_forager.py's strategy, untouched by this module.
"""

import numpy as np

from .errors import ExtractError
from .selection import _check_unique_edges
from .selection_forager import _input_order, _output_order, _matches_input

UINT16_MAX = 65535
# forager-brain.json's own `pathways` encodes exactly this correspondence; classSeed reuses `inputs` verbatim
# (contracts/extract-config-classseed.md) but carries no `pathways` key, so side matching groups channels by
# their declared `class` instead of a pathway lookup.
CLASS_TO_PATHWAY = {"olfactory": "odour", "gustatory": "taste"}


def _fail(code, message):
    raise ExtractError(code, message)


def _match_sides(inputs, config, bodies, ids):
    """D1 side matching, generalised from selection_forager._match_sides to a plain list of channel ids
    (classSeed has no `pathways` key to read them from)."""
    left = [cid for cid in ids if config["inputs"][cid]["rootSide"] == "L"]
    right = [cid for cid in ids if config["inputs"][cid]["rootSide"] == "R"]
    if len(left) != 1 or len(right) != 1:
        _fail("E-CONFIG", "a side-matched input class needs exactly one left and one right channel")
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
    """Like selection_forager.resolve_pools (ADR 003 D1), without a `pathways` key: channels are grouped for
    side matching by their declared `class` (CLASS_TO_PATHWAY), not by a pathway lookup."""
    inputs = {}
    for cid in _input_order(config):
        spec = config["inputs"][cid]
        inputs[cid] = [b for b in sorted(bodies) if _matches_input(bodies[b], spec)]
        if not inputs[cid]:
            _fail("E-POOL-EMPTY", f"input pool {cid} matches no admitted body")

    by_pathway = {}
    for cid in _input_order(config):
        pathway = CLASS_TO_PATHWAY.get(config["inputs"][cid]["class"])
        if pathway:
            by_pathway.setdefault(pathway, []).append(cid)

    for pathway, ids in by_pathway.items():
        if config["sideMatch"].get(pathway):
            _match_sides(inputs, config, bodies, ids)
        for cid in ids:
            if not inputs[cid]:
                _fail("E-SIDE-IMBALANCE", f"{pathway} pool {cid} is empty after side matching")
        if config["sideMatch"].get(pathway) and len(ids) == 2:
            left, right = ids
            if config["inputs"][left]["rootSide"] != "L":
                left, right = right, left
            if len(inputs[left]) != len(inputs[right]):
                _fail("E-SIDE-IMBALANCE", f"{pathway} pools differ in size after side matching: "
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
    return inputs, outputs


def apply_threshold(edges, min_synapses):
    """D11: edges with fewer than min_synapses are dropped, before scoring, selection and weights."""
    pre, post, syn = edges
    pre = np.asarray(pre, dtype=np.int64)
    post = np.asarray(post, dtype=np.int64)
    syn = np.asarray(syn, dtype=np.int64)
    keep = syn >= min_synapses
    return pre[keep], post[keep], syn[keep]


def seed_bodies(config, bodies):
    """D8: every traced body matching a class/superclass filter in config['seeds']. No budget, no sampling.

    Returns {bodyId: "seed:<the matched class or superclass value>"}. Raises E-SEED-EMPTY when a filter entry
    (the whole class/superclass list of one seeds[] item) matches no traced body.
    """
    seeds = {}
    for filt in config["seeds"]:
        if "class" in filt:
            key, values = "class", filt["class"]
        else:
            key, values = "superclass", filt["superclass"]
        wanted = set(values)
        matched = {b: f"seed:{body[key]}" for b, body in bodies.items() if body.get(key) in wanted}
        if not matched:
            _fail("E-SEED-EMPTY", f"seed filter {key}={values} matches no traced body")
        seeds.update(matched)
    return seeds


def _excluded_from_fill(body, fill_cfg):
    """D9's candidate exclusion: sensory classes/superclass suffix, and motor superclasses (ADR 003 D3 list)."""
    if body.get("class") in fill_cfg["excludeClasses"]:
        return True
    suffix = fill_cfg["excludeSuperclassSuffix"]
    if suffix and (body.get("superclass") or "").endswith(suffix):
        return True
    return body.get("superclass") in fill_cfg["excludeSuperclasses"]


def fill_candidates(config, bodies, edges, seeds):
    """D9: fill up to fill.neuronCount (seeds included) by total shared synapse weight with the seed set.

    `edges` is (pre, post, synapses) already thresholded at minSynapses (D11), over every admitted body, not
    just the seeds. `seeds` is an iterable of bodyIds (the central-class seeds, plus input/output pools).
    Returns a set of fill bodyIds. Raises E-SEED-OVERFLOW when len(seeds) already exceeds fill.neuronCount.
    """
    fill_cfg = config["fill"]
    total = fill_cfg["neuronCount"]
    seed_ids = set(int(s) for s in seeds)
    if len(seed_ids) > total:
        _fail("E-SEED-OVERFLOW", f"{len(seed_ids)} seeds (classes and pools) exceed fill.neuronCount {total}")
    need = total - len(seed_ids)
    if need == 0:
        return set()

    all_ids = np.array(sorted(bodies), dtype=np.int64)
    n = all_ids.size
    pre, post, syn = (np.asarray(a, dtype=np.int64) for a in edges)
    both_admitted = np.isin(pre, all_ids) & np.isin(post, all_ids)
    pre, post, syn = pre[both_admitted], post[both_admitted], syn[both_admitted]
    pre_i = np.searchsorted(all_ids, pre)
    post_i = np.searchsorted(all_ids, post)

    seed_dense = np.zeros(n, dtype=bool)
    seed_dense[np.searchsorted(all_ids, np.array(sorted(seed_ids), dtype=np.int64))] = True

    # shared(i) = Σ_{s in seeds} [syn(i->s) + syn(s->i)]: edges where the other end is a seed.
    to_seed = seed_dense[post_i]
    from_seed = seed_dense[pre_i]
    shared = np.bincount(pre_i[to_seed], weights=syn[to_seed].astype(np.float64), minlength=n)
    shared += np.bincount(post_i[from_seed], weights=syn[from_seed].astype(np.float64), minlength=n)

    excluded = np.array([_excluded_from_fill(bodies[int(b)], fill_cfg) for b in all_ids], dtype=bool)
    candidate_mask = (~seed_dense) & (~excluded)
    candidates = np.nonzero(candidate_mask)[0]
    ranked = sorted(candidates.tolist(), key=lambda i: (-shared[i], int(all_ids[i])))
    return {int(all_ids[i]) for i in ranked[:need]}


def _dense_sign(all_ids, bodies):
    return np.array([bodies[int(b)]["sign"] for b in all_ids], dtype=np.float64)


def _weighted_edges(pre_i, post_i, syn, sign_dense, denom_dense):
    """D12: weight(i->j) = sign(i) x syn(i->j) / Σ_{k admitted, syn(k->j)>=minSynapses} syn(k->j)."""
    denom = denom_dense[post_i]
    safe = np.where(denom > 0, denom, 1.0)
    return (sign_dense[pre_i] * syn.astype(np.float64) / safe)


def _propagate(pre_i, post_i, weight, n, pool_indices, steps):
    """r = Σ_{t=1..steps} A^t x0, x0 = 1/|pool| on pool_indices, A given by (pre_i, post_i, weight)."""
    x = np.zeros(n)
    if len(pool_indices):
        x[np.asarray(pool_indices, dtype=np.int64)] = 1.0 / len(pool_indices)
    r = np.zeros(n)
    for _ in range(steps):
        x = np.bincount(post_i, weights=weight * x[pre_i], minlength=n) if pre_i.size else np.zeros(n)
        r += x
    return r


def _probe_pools(inputs, outputs):
    """The probe's own pool labels (ADR 006 D13/Annex A4): odour-L, odour-R and one combined taste pool."""
    input_pools = {
        "odour-L": inputs["odour-left"],
        "odour-R": inputs["odour-right"],
        "taste": sorted(set(inputs["taste-left"]) | set(inputs["taste-right"])),
    }
    return input_pools, dict(outputs)


def fidelity_probe(config, brain_graph, whole_graph, input_pools, outputs):
    """D13: the linear-propagation extraction-fidelity probe, run on the selected brain and on the whole
    thresholded admitted graph, before the container is written.

    `brain_graph`/`whole_graph` are dicts {"pre", "post" (dense local indices), "weight", "n", "index_of"
    (bodyId -> local index)}, both with output-pool outgoing edges already excluded (D13's "outputs as sinks").
    `input_pools` is {label: [bodyId, ...]}; `outputs` is {outputId: [bodyId, ...]}.
    Returns the FidelityReport (data-model.md). Raises E-FIDELITY when fidelity.require is true and either the
    steering or the feeding check fails.
    """
    steps = config["fidelity"]["steps"]
    value = {}
    for graph_name, graph in (("brain", brain_graph), ("wholeGraph", whole_graph)):
        for pool_label, pool_ids in input_pools.items():
            pool_local = [graph["index_of"][b] for b in pool_ids if b in graph["index_of"]]
            r = _propagate(graph["pre"], graph["post"], graph["weight"], graph["n"], pool_local, steps)
            for output_id, out_ids in outputs.items():
                out_local = [graph["index_of"][b] for b in out_ids if b in graph["index_of"]]
                value[(graph_name, pool_label, output_id)] = float(np.mean(r[out_local])) if out_local else 0.0

    def v(graph_name, pool, output):
        return value[(graph_name, pool, output)]

    table = {}
    for pool_label in input_pools:
        for output_id in outputs:
            table[f"{pool_label}→{output_id}"] = {
                "brain": v("brain", pool_label, output_id),
                "wholeGraph": v("wholeGraph", pool_label, output_id),
            }

    def contrast(graph_name):
        return ((v(graph_name, "odour-L", "turn-left") - v(graph_name, "odour-L", "turn-right"))
                - (v(graph_name, "odour-R", "turn-left") - v(graph_name, "odour-R", "turn-right")))

    brain_contrast, whole_contrast = contrast("brain"), contrast("wholeGraph")
    min_fraction = config["fidelity"]["minContrastFraction"]
    fraction = brain_contrast / whole_contrast if whole_contrast != 0 else 0.0
    steering_pass = bool(
        whole_contrast != 0 and np.sign(brain_contrast) == np.sign(whole_contrast)
        and abs(brain_contrast) >= min_fraction * abs(whole_contrast)
    )

    brain_feed, whole_feed = v("brain", "taste", "feed"), v("wholeGraph", "taste", "feed")
    feeding_pass = bool(whole_feed != 0 and np.sign(brain_feed) == np.sign(whole_feed))

    report = {
        "table": table,
        "steering": {
            "pass": steering_pass, "brainContrast": brain_contrast,
            "wholeGraphContrast": whole_contrast, "fraction": fraction,
        },
        "feeding": {"pass": feeding_pass, "brainValue": brain_feed, "wholeGraphValue": whole_feed},
    }
    if config["fidelity"]["require"] and not (steering_pass and feeding_pass):
        if not steering_pass:
            _fail("E-FIDELITY", f"steering check failed: brain {brain_contrast:g} vs whole graph {whole_contrast:g}")
        _fail("E-FIDELITY", f"feeding check failed: brain {brain_feed:g} vs whole graph {whole_feed:g}")
    return report


def select_class_seed(config, bodies, edges):
    """Apply D8-D13 to the allTraced-admitted bodies and the restricted edges.

    `bodies` is every admitted (Traced) body (admission.admit_all_traced). `edges` is (pre, post, synapses) over
    those bodies, not yet thresholded. Returns the brain as a dict shaped like select_forager's: `neurons`
    (container order: inputs, outputs, then interneurons by ascending bodyId, each tagged `origin`/`transmitter`),
    the CSR arrays, `edgeCount`, `pools`, and `fidelity` (the D13 report).
    """
    min_synapses = config["minSynapses"]
    ids = np.array(sorted(bodies), dtype=np.int64)
    pre_raw, post_raw, syn_raw = (np.asarray(a, dtype=np.int64) for a in edges)
    keep_admitted = np.isin(pre_raw, ids) & np.isin(post_raw, ids)
    pre, post, syn = apply_threshold((pre_raw[keep_admitted], post_raw[keep_admitted], syn_raw[keep_admitted]),
                                      min_synapses)
    _check_unique_edges(pre, post)

    inputs, outputs = resolve_pools(config, bodies)
    output_bodies = sorted({b for members in outputs.values() for b in members})
    pool_bodies = {b for members in inputs.values() for b in members} | set(output_bodies)
    memberships = sum(len(m) for m in inputs.values()) + sum(len(m) for m in outputs.values())
    if len(pool_bodies) != memberships:
        _fail("E-CONFIG", "a body is a member of two pools")

    class_seeds = seed_bodies(config, bodies)
    seed_ids = set(class_seeds) | pool_bodies
    fill_ids = fill_candidates(config, bodies, (pre, post, syn), seed_ids)
    brain_ids = sorted(seed_ids | fill_ids)

    # D12's denominator and every edge's weight, computed once over the full admitted thresholded graph.
    all_ids = np.array(sorted(bodies), dtype=np.int64)
    n_all = all_ids.size
    pre_i_full = np.searchsorted(all_ids, pre)
    post_i_full = np.searchsorted(all_ids, post)
    sign_dense = _dense_sign(all_ids, bodies)
    denom_dense = np.bincount(post_i_full, weights=syn.astype(np.float64), minlength=n_all)
    weight_full = _weighted_edges(pre_i_full, post_i_full, syn, sign_dense, denom_dense)

    # D9 brain = induced subgraph on seeds ∪ fill; D2 outputs are sinks: their outgoing edges are dropped.
    brain_ids_arr = np.array(brain_ids, dtype=np.int64)
    in_brain = np.isin(all_ids, brain_ids_arr)
    output_dense = np.zeros(n_all, dtype=bool)
    output_dense[np.searchsorted(all_ids, np.array(output_bodies, dtype=np.int64))] = True
    keep_brain = in_brain[pre_i_full] & in_brain[post_i_full] & ~output_dense[pre_i_full]

    local = np.full(n_all, -1, dtype=np.int64)
    local[np.searchsorted(all_ids, brain_ids_arr)] = np.arange(brain_ids_arr.size)

    src = local[pre_i_full[keep_brain]]
    dst = local[post_i_full[keep_brain]]
    raw = syn[keep_brain]
    weights = weight_full[keep_brain].astype(np.float32)

    if raw.size and int(raw.max()) > UINT16_MAX:
        _fail("E-OVERFLOW", f"a synapse count of {int(raw.max())} exceeds {UINT16_MAX}")

    sorting = np.lexsort((dst, src))
    src, dst, raw, weights = src[sorting], dst[sorting], raw[sorting], weights[sorting]

    count = brain_ids_arr.size
    for cid, members in outputs.items():
        local_members = {int(local[int(np.searchsorted(all_ids, b))]) for b in members}
        if not any(int(d) in local_members for d in dst):
            _fail("E-OUTPUT-UNREACHED", f"output pool {cid} receives no edge from the selected neurons")

    # Neuron order (W5/container-v4): inputs, then outputs, then interneurons by ascending bodyId.
    order = []
    for cid in _input_order(config):
        order += [(b, "input", cid) for b in inputs[cid]]
    for cid in _output_order(config):
        order += [(b, "output", cid) for b in outputs[cid]]
    interneurons = sorted(set(brain_ids) - pool_bodies)
    order += [(b, "interneuron", None) for b in interneurons]
    if len(order) != count:
        _fail("E-NODE-RANGE", f"selected {len(order)} neurons, fill.neuronCount is {config['fill']['neuronCount']}")

    neurons = []
    for k, (body, role, channel) in enumerate(order):
        b = bodies[body]
        origin = class_seeds.get(body, "fill" if body in fill_ids else None) if role == "interneuron" else None
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
            "sign": b["sign"],
            "origin": origin,
        })

    offsets = np.zeros(count + 1, dtype=np.uint32)
    offsets[1:] = np.cumsum(np.bincount(src, minlength=count))

    pools = {}
    for cid in inputs:
        pools[cid] = [k for k, nr in enumerate(neurons) if nr["channel"] == cid]
    for cid in outputs:
        pools[cid] = [k for k, nr in enumerate(neurons) if nr["channel"] == cid]

    # D13: the fidelity probe, on the brain's own local-index graph and on the whole thresholded admitted graph.
    # Both exclude output-pool outgoing edges ("outputs as sinks" — the brain already does; the whole graph is
    # given the same treatment here so the two values being compared mean the same thing).
    index_of_all = {int(b): i for i, b in enumerate(all_ids.tolist())}
    whole_graph = {
        "pre": pre_i_full[~output_dense[pre_i_full]],
        "post": post_i_full[~output_dense[pre_i_full]],
        "weight": weight_full[~output_dense[pre_i_full]],
        "n": n_all,
        "index_of": index_of_all,
    }
    index_of_brain = {int(b): i for i, b in enumerate(brain_ids)}
    brain_graph = {"pre": src, "post": dst, "weight": weights.astype(np.float64), "n": count,
                   "index_of": index_of_brain}
    probe_inputs, probe_outputs = _probe_pools(inputs, outputs)
    fidelity = fidelity_probe(config, brain_graph, whole_graph, probe_inputs, probe_outputs)

    return {
        "neurons": neurons,
        "offsets": offsets,
        "targets": dst.astype(np.uint32),
        "weights": weights,
        "synapses": raw.astype(np.uint16),
        "edgeCount": int(src.size),
        "pools": pools,
        "fidelity": fidelity,
        "seedCount": len(seed_ids),
        "fillCount": len(fill_ids),
    }
