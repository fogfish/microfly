"""Sensory -> motor connectivity audit of a class-seeded snapshot against the whole MaleCNS graph.

ADR 006 D9/D13 and ADR 007 D19 check one number per sense (the linear L/R turn contrast). This audit asks where
that number comes from: does every sensory pool still reach every motor pool, which neurons carry each sense's
steering contrast in the whole graph, which of them the cut dropped, and whether the declared readout pools are
where the contrast lands at all. It is a measurement, not a selection rule: nothing here feeds the extractor.

The whole graph is the one selection_class_seed sees: allTraced admission, minSynapses threshold, D12
postFractionAbsolute weights, output pools as sinks. The brain graph is its induced subgraph on the snapshot's
neurons, so both share the same weights (the snapshot's edge count is checked against it).

    cd extract && MALECNS_DIR=../data/malecns .venv/bin/python ../scripts/connectivity-audit.py \\
        --config configs/forager-brain-wide.json --snapshot ../public/brains/forager-brain-wide.brain

Sections (--sections, default all):
  coverage   output pool in-flow: share of each motor pool's input synapses that come from the cut
  paths      per input -> output: shortest hops (any / excitatory-only), retained |path mass|, signed value
  lesions    L/R turn contrast per sense with neuron categories removed (LH, MB, SEZ, LAL/PS/VES, other DNs)
  trapped    share of each pool's forward mass, inside the brain, on neurons with no path to any output
  retention  per category: neurons kept, and share of their output synapses that stay inside the cut
  bridges    per sense, the neurons carrying the signed L/R contrast in the whole graph, and the top missing
  whatif     brain contrast when the top-k missing contrast bridges are added to the cut
  readout    per sense, the bilateral DN types with the largest L/R contrast, against DNa01/DNa02
"""

import argparse
import collections
import json
import os
import pickle
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "extract"))
from malecns_brain import dataset  # noqa: E402
from malecns_brain.admission import admit_all_traced  # noqa: E402

SECTIONS = ["coverage", "paths", "lesions", "trapped", "retention", "bridges", "whatif", "readout"]
# The fidelity probe's horizon (fidelity.steps in every class-seeded config), so the numbers are comparable.
STEPS = 8
WHATIF_K = (0, 10, 25, 50, 100, 250, 500)


def read_snapshot(path):
    """Header and CSR edge count of a container-v4 snapshot (snapshot.js parseSnapshot layout)."""
    with open(path, "rb") as f:
        raw = f.read()
    if raw[:4] != b"MFBR":
        sys.exit(f"{path}: not a brain snapshot")
    _, header_length = struct.unpack("<II", raw[4:12])
    return json.loads(raw[12:12 + header_length])


def whole_graph(config, dataset_dir, cache):
    """allTraced bodies and minSynapses-thresholded edges, cached as npz + pickle (the read takes a while)."""
    if cache and os.path.isfile(cache + ".npz"):
        z = np.load(cache + ".npz")
        with open(cache + ".pkl", "rb") as f:
            meta = pickle.load(f)
        return z["ids"], z["pre"], z["post"], z["syn"], meta
    annotations = dataset.load_annotations(dataset_dir, dataset.FORAGER_ANNOTATION_COLUMNS)
    transmitters = dataset.load_neurotransmitter_table(dataset_dir, config["transmitterColumn"])
    bodies = admit_all_traced(annotations, transmitters, config)
    ids = np.array(sorted(bodies), dtype=np.int64)
    pre, post, syn = dataset.stream_edges(dataset_dir, ids, config["minSynapses"])
    meta = {int(b): {k: bodies[b].get(k) for k in ("class", "superclass", "type", "somaSide", "sign")} for b in ids}
    if cache:
        np.savez(cache + ".npz", ids=ids, pre=pre, post=post, syn=syn)
        with open(cache + ".pkl", "wb") as f:
            pickle.dump(meta, f)
    return ids, pre, post, syn, meta


def category(m):
    """Coarse anatomical category. LH, SEZ and LAL/PS/VES have no class in MaleCNS, so they go by type prefix."""
    c, s, t = m["class"], m["superclass"] or "", m["type"] or ""
    if c == "Kenyon_Cell":
        return "KC"
    if c == "ALPN":
        return "ALPN"
    if c in ("ALLN", "ALIN", "ALON"):
        return "AL-other"
    if c in ("MBON", "DAN"):
        return c
    if s == "descending_neuron":
        return "DN"
    if s == "ascending_neuron":
        return "AN"
    if s.endswith("_motor"):
        return "motor"
    if s.endswith("sensory") or c in ("olfactory", "gustatory", "thermosensory"):
        return "sensory"
    if s.startswith("vnc"):
        return "VNC"
    if t.startswith("LH"):
        return "LHN"
    if t.startswith(("GNG", "SAD", "AMMC", "PRW")):
        return "SEZ"
    if t.startswith(("LAL", "PS", "WED", "VES", "IB", "SPS")):
        return "LAL/PS/VES"
    if s.startswith(("visual", "optic")):
        return "visual"
    return "other-central"


class Audit:
    def __init__(self, header, ids, pre, post, syn, meta):
        self.meta, self.ids, self.n = meta, ids, ids.size
        self.idx = {int(b): i for i, b in enumerate(ids)}
        self.pi, self.qi, self.syn = np.searchsorted(ids, pre), np.searchsorted(ids, post), syn
        self.sign = np.array([meta[int(b)]["sign"] for b in ids], dtype=float)
        denom = np.bincount(self.qi, weights=syn.astype(float), minlength=self.n)
        self.wabs = syn / denom[self.qi]  # D12 without the sign
        self.wsig = self.sign[self.pi] * self.wabs
        self.cats = np.array([category(meta[int(b)]) for b in ids])

        neurons = header["neurons"]
        channels = header["capabilities"]["channels"]
        self.inputs = {c["id"]: [neurons[i]["bodyId"] for i in c["neurons"]] for c in channels["inputs"]}
        self.outputs = {c["id"]: [neurons[i]["bodyId"] for i in c["neurons"]] for c in channels["outputs"]}
        self.in_cut = self.mask([nr["bodyId"] for nr in neurons])
        self.out_dense = self.mask([b for v in self.outputs.values() for b in v])
        self.base = ~self.out_dense[self.pi]  # outputs are sinks (D13)
        self.brain = self.base & self.in_cut[self.pi] & self.in_cut[self.qi]
        if int(self.brain.sum()) != header["edgeCount"]:
            sys.exit(f"brain graph has {int(self.brain.sum())} edges, the snapshot {header['edgeCount']}: "
                     "config and snapshot do not match")
        self.graphs = {"whole": self.base, "brain": self.brain}
        self.tl, self.tr = self.local(self.outputs["turn-left"]), self.local(self.outputs["turn-right"])
        self.pairs = collections.OrderedDict()
        for cid in self.inputs:
            stem = cid.rsplit("-", 1)[0]
            if cid.endswith("-left") and stem + "-right" in self.inputs:
                self.pairs[stem] = (cid, stem + "-right")
        self.F = {}
        for cid, bs in self.inputs.items():
            for g, m in self.graphs.items():
                self.F[(cid, g, "abs")] = self.fwd(self.vec(bs), m, self.wabs)
                self.F[(cid, g, "sig")] = self.fwd(self.vec(bs), m, self.wsig)
        yl, yr = np.zeros(self.n), np.zeros(self.n)
        yl[self.tl], yr[self.tr] = 1.0 / len(self.tl), 1.0 / len(self.tr)
        self.bturn = self.bwd(yl, self.base, self.wsig) - self.bwd(yr, self.base, self.wsig)

    def local(self, bodies):
        return [self.idx[b] for b in bodies]

    def mask(self, bodies):
        m = np.zeros(self.n, dtype=bool)
        m[self.local(bodies)] = True
        return m

    def vec(self, bodies):
        x = np.zeros(self.n)
        x[self.local(bodies)] = 1.0 / len(bodies)
        return x

    def fwd(self, x, edges, w):
        """Σ_{t=1..STEPS} A^t x, the fidelity probe's propagation (selection_class_seed._propagate)."""
        p, q, ww = self.pi[edges], self.qi[edges], w[edges]
        r = np.zeros(self.n)
        for _ in range(STEPS):
            x = np.bincount(q, weights=ww * x[p], minlength=self.n)
            r += x
        return r

    def bwd(self, y, edges, w):
        p, q, ww = self.pi[edges], self.qi[edges], w[edges]
        r = np.zeros(self.n)
        for _ in range(STEPS):
            y = np.bincount(p, weights=ww * y[q], minlength=self.n)
            r += y
        return r

    def contrast(self, edges, left, right):
        """The fidelity probe's turn contrast: > 0 means turn toward the stimulated side."""
        fl = self.fwd(self.vec(self.inputs[left]), edges, self.wsig)
        fr = self.fwd(self.vec(self.inputs[right]), edges, self.wsig)
        return (fl[self.tl].mean() - fl[self.tr].mean()) - (fr[self.tl].mean() - fr[self.tr].mean())

    def hops(self, src, dst, edges, excitatory_only=False):
        p, q = self.pi[edges], self.qi[edges]
        if excitatory_only:
            keep = self.sign[p] > 0
            p, q = p[keep], q[keep]
        order = np.argsort(p, kind="stable")
        p, q = p[order], q[order]
        start, end = np.searchsorted(p, np.arange(self.n)), np.searchsorted(p, np.arange(self.n), "right")
        dist = np.full(self.n, -1)
        frontier = np.array(self.local(src))
        dist[frontier] = 0
        target = np.array(self.local(dst))
        for d in range(1, 13):
            if not frontier.size:
                return None
            nxt = np.unique(np.concatenate([q[start[v]:end[v]] for v in frontier]))
            nxt = nxt[dist[nxt] < 0]
            dist[nxt] = d
            frontier = nxt
            if (dist[target] >= 0).any():
                return d
        return None

    def contrast_flow(self, stem):
        """c(v) = [fL - fR](v) × [bTL - bTR](v): the signed L/R steering contrast on paths through v."""
        left, right = self.pairs[stem]
        c = (self.F[(left, "whole", "sig")] - self.F[(right, "whole", "sig")]) * self.bturn
        c[self.mask(self.inputs[left] + self.inputs[right]) | self.out_dense] = 0
        return c

    def describe(self, i):
        m = self.meta[int(self.ids[i])]
        return f'{m["type"]}/{m["somaSide"]}/{self.cats[i]}'

    # Sections ----------------------------------------------------------------------------------------------

    def coverage(self):
        print("\n## Output pool in-flow coverage (synapses from the cut / all admitted presynaptic)")
        for oid, bodies in self.outputs.items():
            m = self.mask(bodies)[self.qi]
            total = self.syn[m].sum()
            lost = m & ~self.in_cut[self.pi]
            missing = collections.Counter()
            for c, s in zip(self.cats[self.pi[lost]], self.syn[lost]):
                missing[c] += s
            print(f"{oid:12s} {self.syn[m & self.in_cut[self.pi]].sum() / total:6.1%} of {total} syn; missing: "
                  + ", ".join(f"{k} {v / total:.1%}" for k, v in missing.most_common(5)))

    def paths(self):
        print("\n## Input -> output: shortest hops (W whole, B brain; any / excitatory-only), retained |mass|, signed")
        print(f'{"input":22s} {"output":10s} {"hopW":>4s} {"hopB":>4s} {"excW":>4s} {"excB":>4s} '
              f'{"|mass|B/W":>9s} {"signedW":>10s} {"signedB":>10s}')
        for cid, src in self.inputs.items():
            for oid, dst in self.outputs.items():
                y = self.local(dst)
                aw, ab = self.F[(cid, "whole", "abs")][y].mean(), self.F[(cid, "brain", "abs")][y].mean()
                sw, sb = self.F[(cid, "whole", "sig")][y].mean(), self.F[(cid, "brain", "sig")][y].mean()
                h = [self.hops(src, dst, self.graphs[g], e) for e in (False, True) for g in ("whole", "brain")]
                print(f"{cid:22s} {oid:10s} {str(h[0]):>4s} {str(h[1]):>4s} {str(h[2]):>4s} {str(h[3]):>4s} "
                      f"{ab / aw if aw else 0:9.1%} {sw:10.2e} {sb:10.2e}")

    def lesions(self):
        print("\n## L/R turn contrast (> 0 toward the stimulated side) with neuron categories removed")
        lesions = {
            "none": np.zeros(self.n, dtype=bool),
            "-LHN": self.cats == "LHN",
            "-KC,MBON": np.isin(self.cats, ["KC", "MBON"]),
            "-LHN,KC,MBON": np.isin(self.cats, ["LHN", "KC", "MBON"]),
            "-SEZ": self.cats == "SEZ",
            "-LAL/PS/VES": self.cats == "LAL/PS/VES",
            "-otherDN": (self.cats == "DN") & ~self.out_dense,
        }
        print(f'{"pair":14s} {"graph":6s} ' + " ".join(f"{k:>13s}" for k in lesions))
        for stem, (left, right) in self.pairs.items():
            for g, m in self.graphs.items():
                row = [self.contrast(m & ~les[self.pi] & ~les[self.qi], left, right) for les in lesions.values()]
                print(f"{stem:14s} {g:6s} " + " ".join(f"{v:13.2e}" for v in row))

    def trapped(self):
        print(f"\n## Trapped: share of forward |mass| in the brain on neurons with no path to any output ({STEPS} hops)")
        y = np.zeros(self.n)
        y[self.out_dense] = 1.0
        reaches = self.bwd(y, self.brain, self.wabs) > 0
        for cid, bodies in self.inputs.items():
            f = self.F[(cid, "brain", "abs")].copy()
            f[self.mask(bodies) | self.out_dense] = 0
            total = f.sum()
            by = collections.Counter()
            for c, v in zip(self.cats[~reaches], f[~reaches]):
                by[c] += v
            print(f"{cid:22s} {f[~reaches].sum() / total if total else 0:6.1%}; by category: "
                  + ", ".join(f"{k} {v / total:.1%}" for k, v in by.most_common(4)))

    def retention(self):
        print("\n## Per category: neurons in the cut, and share of their output synapses that stay in the cut")
        for c in ["ALPN", "LHN", "KC", "MBON", "DAN", "SEZ", "LAL/PS/VES", "DN", "other-central", "AN", "VNC"]:
            sel = self.in_cut & (self.cats == c)
            m = sel[self.pi]
            total = self.syn[m].sum()
            if total:
                print(f"{c:14s} {sel.sum():5d} / {(self.cats == c).sum():6d}; "
                      f"out-syn kept {self.syn[m & self.in_cut[self.qi]].sum() / total:6.1%}")

    def bridges(self):
        print("\n## Steering-contrast bridges (whole graph): who carries each sense's signed L/R contrast")
        for stem in self.pairs:
            c = self.contrast_flow(stem)
            a = np.abs(c)
            total = a.sum()
            by, kept, net = collections.Counter(), collections.Counter(), collections.Counter()
            for cat, v, inside in zip(self.cats, c, self.in_cut):
                by[cat] += abs(v)
                net[cat] += v
                kept[cat] += abs(v) if inside else 0
            print(f"\n### {stem}: |contrast flow| on cut neurons {a[self.in_cut].sum() / total:.1%}; "
                  f"net signed whole {c.sum():+.2e}, on cut neurons {c[self.in_cut].sum():+.2e}")
            print("  by category, share (kept, net sign): " + ", ".join(
                f'{k} {v / total:.1%} ({kept[k] / v:.0%}, {"+" if net[k] > 0 else "-"})'
                for k, v in by.most_common(8)))
            order = np.argsort(-a)
            print("  top 15: " + ", ".join(
                f'{self.describe(i)}/{"in" if self.in_cut[i] else "OUT"}/{c[i] / total:+.1%}' for i in order[:15]))
            missing = [i for i in order if not self.in_cut[i]][:15]
            print("  top missing: " + ", ".join(f"{self.describe(i)}/{c[i] / total:+.1%}" for i in missing))

    def whatif(self):
        print("\n## What-if: brain turn contrast / whole graph when the top-k missing contrast bridges join the cut")
        for stem, (left, right) in self.pairs.items():
            whole = self.contrast(self.base, left, right)
            c = self.contrast_flow(stem)
            c[self.in_cut] = 0
            order = np.argsort(-np.abs(c))
            row = []
            for k in WHATIF_K:
                cut = self.in_cut.copy()
                cut[order[:k]] = True
                row.append(f"k={k}: {self.contrast(self.base & cut[self.pi] & cut[self.qi], left, right) / whole:6.1%}")
            print(f"{stem:14s} " + "  ".join(row))

    def readout(self):
        print("\n## Readout: bilateral DN types by the L/R contrast each sense puts on them (ipsi minus contra)")
        types = collections.defaultdict(lambda: {"L": [], "R": []})
        for i in np.nonzero((self.cats == "DN") | self.out_dense)[0]:
            m = self.meta[int(self.ids[i])]
            if m["somaSide"] in ("L", "R") and m["type"]:
                types[m["type"]][m["somaSide"]].append(i)
        types = {t: v for t, v in types.items() if v["L"] and v["R"]}
        for stem, (left, right) in self.pairs.items():
            value = {}
            for g in ("whole", "brain"):
                d = self.F[(left, g, "sig")] - self.F[(right, g, "sig")]
                value[g] = {t: d[v["L"]].mean() - d[v["R"]].mean() for t, v in types.items()}
            ranked = sorted(types, key=lambda t: -abs(value["whole"][t]))
            rank = {t: k + 1 for k, t in enumerate(ranked)}
            readout = ", ".join(f'{t} rank {rank[t]} ({value["whole"][t]:+.1e})' for t in ("DNa01", "DNa02") if t in rank)
            print(f"\n### {stem}: {readout} of {len(ranked)} DN types")
            print("  top 12 (whole -> brain): " + ", ".join(
                f'{t} {value["whole"][t]:+.1e}->{value["brain"][t]:+.1e}' for t in ranked[:12]))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--config", required=True, help="the snapshot's extract config")
    ap.add_argument("--snapshot", required=True)
    ap.add_argument("--dataset", default=os.environ.get("MALECNS_DIR", "data/malecns"))
    ap.add_argument("--cache", default=None, help="path prefix to cache the whole graph (npz + pkl)")
    ap.add_argument("--sections", default=",".join(SECTIONS))
    args = ap.parse_args()
    sections = args.sections.split(",")
    for s in sections:
        if s not in SECTIONS:
            sys.exit(f"unknown section {s}; choose from {', '.join(SECTIONS)}")

    with open(args.config) as f:
        config = json.load(f)
    if config.get("selection") != "classSeed":
        sys.exit("the audit compares a classSeed cut against its allTraced whole graph; this config is not classSeed")
    header = read_snapshot(args.snapshot)
    audit = Audit(header, *whole_graph(config, args.dataset, args.cache))
    print(f"# {os.path.basename(args.snapshot)}: {int(audit.in_cut.sum())} of {audit.n} admitted neurons, "
          f"{int(audit.brain.sum())} of {int(audit.base.sum())} edges (minSynapses {config['minSynapses']}, "
          f"{STEPS}-step linear probe)")
    for s in sections:
        getattr(audit, s)()


if __name__ == "__main__":
    main()
