# Contract Amendment: decoder v1, social additions

**Amends**: `specs/017-demo-forager/contracts/decoder-v1.md`. These are additions only, so the version stays 1.
Writer: the `microfly-calibrate` C2 stage (profile `social-v3`). Reader: `public/js/fly/decoder.js`.

## Pools

- `drive.odour-conspecific`, `drive.contact-pheromone`, and `side.<pair>.L` / `side.<pair>.R` for each social pair.
  D27 chooses them under its unchanged gates.
- The social pairs join the condition set: rest, then left-only, right-only and bilateral for every pair. D27's
  sense-specificity gate (≥ 2× the rise under any other pair) therefore also keeps the food and danger pools free of
  conspecific responders (research R15).
- `song` is the indices of the snapshot's `song` output pool. It is a named pool like `feed`, and its rest comes from
  `homeostasis` (D33).

## Valence

- `valence["odour-conspecific"]` and `valence["contact-pheromone"]` are each `approach`, `avoid` or `none`.
- C2 does not pick them. The profile takes them from `claims.md` by the rule in research R7, and ADR 012 records them.
  The decoder file carries `valenceSource: { "<pair>": "claims.md#<row>" }` for each social pair.

## Reader

- An unknown pair is still rejected. The social pairs are known because the snapshot declares them.
- `song` without a snapshot `song` output is rejected with `decoder: song pool needs a snapshot song output`.
- `decodeTick` returns `named.song = { r, rest, drive }` when the pool exists.

## Tests

- A decoder with social pools and `song` loads against the social snapshot.
- `song` against the MB snapshot is rejected.
- `named.song.drive` follows the pool rate.
