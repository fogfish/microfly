# Contract Amendment: channel declaration rules, container version 5

**Amends**: `specs/008-hungry-forager-brain/contracts/channel-declaration-v4.md` — the canonical channel-
declaration contract (rules R1–R8, `FORAGER_DRIVES`, `KIND_DRIVES`). Version 5 reuses `kind: "forager"`
(research.md R2) and adds rules R9–R11 plus a six-value drive tuple; R1–R8 keep their existing meaning for
version 4.

## `FORAGER_DRIVES_V2`

```python
FORAGER_DRIVES_V2 = ("turnLeft", "turnRight", "forward", "backward", "feed", "escape")
```

Used only by `validate_capabilities_v5` (Python) / `validateCapabilitiesV5` (JS). `KIND_DRIVES["forager"]` (the
5-tuple) is **not** mutated — `validate_capabilities_v4` keeps using it for container version 4. `KIND_DRIVES`
itself gains no new key; the version-5 validators import `FORAGER_DRIVES_V2` directly rather than looking it up
by `kind`, since `kind` no longer determines drive count on its own (research.md R2).

## New rules (R9–R11)

- **R9 (sense declared)**: every input channel's `sense` is a non-empty string naming one of the six declared
  senses (`odour:food`, `odour:danger`, `heat`, `taste:mouth`, `taste:leg`, `touch`). Any other value fails
  validation with a message naming the channel and the value.
- **R10 (site declared)**: every input channel's `site` is a non-empty string naming one of the declared body
  sites (`antenna`, `mouth`, `front-leg`). Any other value fails the same way.
- **R11 (escape drive present once)**: exactly one output channel declares `drive: "escape"`; zero or more than
  one fails validation naming the count found. (R1–R8's existing per-drive-once rule already covers the other
  five drives; R11 extends the same check to the sixth.)

## R1–R8 carry-over

R1–R8 (declared `neurons` list per channel/pool, no empty channel, no duplicate neuron across channels, drive
values from the kind's vocabulary, etc. — see the canonical document for the full text) apply unchanged to
version 5, with "the kind's vocabulary" now meaning `FORAGER_DRIVES_V2` (6 values) rather than `FORAGER_DRIVES`
(5 values) for this container version.

## Tests

`test_capabilities_v5.py` (Python) and `tests/capabilities-v5.test.mjs` (JS): one test per new rule (R9, R10, R11),
plus a regression test that `validate_capabilities_v4`/`validateCapabilitiesV4` are untouched (still enforce
exactly 5 drives, reject `escape`).
