# Contract Amendment: `weightRule: "postFractionAbsolute"` (D4′)

**Amends**: `specs/008-hungry-forager-brain/contracts/extract-config-forager.md` (the `weightRule` config key) and
`specs/008-hungry-forager-brain/contracts/container-v4.md` (the `weightRule` header rule and the CSR weight
formula). Both canonical documents are updated in place during `/speckit-implement`, per `AGENTS.md`'s "Contracts"
rule — this document specifies the amendment. **Backward-compatible addition**: `"postFraction"` keeps its existing
meaning and keeps working for any config or snapshot that declares it; no `formatVersion` or container-version
bump, since the binary layout and every other rule are unchanged.

## `extract-config-forager.md` amendment

The `weightRule` row of the format-3 forager config's key table:

| Key | Type | Rule (before) | Rule (after) |
|---|---|---|---|
| `weightRule` | `"postFraction"` | Required value. | `"postFraction"` or `"postFractionAbsolute"`. Required; exactly one. |

`extract/malecns_brain/config.py`'s check (currently `if config["weightRule"] != "postFraction": _fail(...)`)
becomes a membership check against `{"postFraction", "postFractionAbsolute"}`, same `E-CONFIG` failure code for
anything else.

## `container-v4.md` amendment

The header table's `weightRule` row:

| Key | Required | Rule (before) | Rule (after) |
|---|---|---|---|
| `weightRule` | yes | `"postFraction"`. | `"postFraction"` or `"postFractionAbsolute"`. |

The "Sections and CSR rules" paragraph's weight formula gains the second case:

> For version 4 the weights are, under `"postFraction"`, `sign(pre) × synapses / Σ synapses(into post, over
> **selected** presynaptic neurons)` (ADR 003 D4); under `"postFractionAbsolute"`, `sign(pre) × synapses / Σ
> synapses(into post, over every **admitted** presynaptic neuron with a real edge into it, selected or not)`
> (ADR 005 D4′). Under either rule, the absolute sum of input weights of a neuron is at most 1.

`extract/malecns_brain/container.py`'s `_check_forager` (currently `if header.get("weightRule") != "postFraction":
_reject(...)`) becomes a membership check against the same two values, same rejection message shape (naming the
actual value found). `_check_inflow`'s "sum ≤ 1" check is unchanged — it already holds under either rule, since the
new rule's selected-only numerator is, by construction, a subset of its own real-admitted denominator.
`public/js/brain/snapshot.js`'s matching JS-side header check accepts the same two values, same error-message
convention (the two readers already share exact wording, per `extract-config-forager.md`'s and `container-v4.md`'s
own "Error messages" sections).

## `selection_forager.py` amendment (the actual denominator change)

Today (`select_forager`, weight computation): after `local`-restricting to the final selection,

```python
src, dst, raw = src_all[inside], dst_all[inside], syn[inside]   # inside: both ends in the final selection
...
total_in = np.bincount(dst, weights=raw, minlength=count)        # sum over SELECTED presynaptic neurons only
weights = (sign_of[src] * raw / total_in[dst]).astype(np.float32)
```

Under `weightRule: "postFractionAbsolute"`, the denominator instead sums over every real, admitted presynaptic edge
into the post neuron — `post_i` already spans the full admitted-body universe, before any `local`/selection
restriction:

```python
total_in_full = np.bincount(post_i, weights=syn, minlength=n)    # n = the full admitted-body universe, not count;
                                                                   # sum over EVERY admitted presynaptic neuron
                                                                   # with a real edge into this post neuron
weights = (sign_of[src] * raw / total_in_full[post_i[inside]]).astype(np.float32)
```

`pre_i, post_i, syn` are already computed, unchanged, earlier in `select_forager` for the flow ranking (D3) — no
new array is read from the dataset, no new pass over the Feather files. Under `weightRule: "postFraction"`
(legacy), the computation is unchanged from today.

## Determinism

Both rules remain a pure function of the admitted bodies and the restricted edge table: the same config and
dataset give a byte-identical snapshot (aside from `provenance.createdAt`), since `total_in_full` is computed the
same deterministic way (`bincount` over already-sorted, already-deterministic arrays) as the rule it replaces.

## Tests (write first)

- A Python test module under `extract/tests/`: a small synthetic admitted-body graph where one neuron's real
  inputs are only partly selected; under `"postFractionAbsolute"` its total modeled input weight is the true
  fraction (less than 1), and under `"postFraction"` it is rescaled to (at most) 1, confirming the two rules give
  different, correctly-ordered results on the same input. A config declaring an unknown `weightRule` value (neither
  of the two) still fails `E-CONFIG`.
- `container.py`'s existing round-trip/self-check tests extended to cover a snapshot built with
  `weightRule: "postFractionAbsolute"`, confirming `_check_inflow`'s "≤ 1" invariant still holds and the JS reader
  (`snapshot.js`) accepts the header.
- Regression: any existing extractor test fixture declaring `weightRule: "postFraction"` must pass unmodified,
  byte-identical to before.
