# Contract: Channel Declaration v6

**Supersedes for new snapshots**: `specs/013-wide-io-forager-brain/contracts/channel-declaration-v5.md`. **v5 stays readable**: every v5 snapshot
loads unchanged. Writer: `extract/malecns_brain/capabilities.py`. Reader: `public/js/brain/capabilities.js`.

## Change from v5

v6 makes one change, to rule R10, the drive set.

| | v5 | v6 |
|---|---|---|
| Required drives | `turnLeft`, `turnRight`, `forward`, `backward`, `feed`, `escape`, each exactly once | same |
| Optional drives | none | `song`, at most once |
| Input fields | `sense`, `site` | same |

Every other rule (R1–R9, R11) is copied from v5 unchanged.

## Version field

Today `snapshot.js` picks the validator from the snapshot `kind` (`forager-wide` goes to `validateCapabilitiesV5`), and
the shipped headers carry no declaration version. v6 adds an optional header field, `capabilities.declaration`, and
the reader dispatches on it for `forager-wide` snapshots:
- if it is absent, the snapshot is v5 and goes to `validateCapabilitiesV5` (unchanged), so every shipped snapshot
  reads as before;
- `6` goes to `validateCapabilitiesV6`;
- any other value is rejected: `unsupported channel declaration <v>`.

The writer sets `declaration: 6` only when the config declares a `song` output. So that old configs stay
byte-identical, it never writes the field otherwise.

## Consumers

- `forager-step-wide.js` `forageEnvWide` takes `drives` from the declared outputs. An optional `song` adds one entry,
  and the code needs no change.
- `decoder.js` reads `song` as a named pool (decoder contract).
- The panel lists `song` with the other outputs.

## Tests

- Python writer: a config with a `song` output gives v6 with `song` in the drives. One without it gives v5.
- JS reader: a v6 snapshot with `song` passes. A v6 with two `song` drives fails. A v5 with `song` fails. Every
  shipped v5 snapshot still passes.
