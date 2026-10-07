# Contract: Fly Sprites (32 × 32)

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md) | **Base**: [specs/002-toy-lif-fly-network/contracts/fly-config.md](../../002-toy-lif-fly-network/contracts/fly-config.md) (sprites, pixel form)

## 1. Form

- Pixel form, as in the existing world config `sprites` map: `pixels` (array of strings) and `palette` (character → colour).
- Exactly 32 rows, each exactly 32 characters. `.` is transparent. Every other character must be in `palette`.
- One cell is 32 px, so the fly fills one cell at zoom 1 (spec FR-013).

## 2. Ids

~~- `fly`: the normal fly. Used by `flies.sprite`.
- `fly-baseline`: the baseline fly. Same 32 × 32 shape as `fly`, different palette only (FR-016). Used by `flies.baselineSprite`.~~

Superseded by BUG-002 (FR-021): one generic shape is replaced by a female and a male shape, distinguished by body/abdomen
shape (not just palette), each with its own baseline:

- `fly-female`: the normal female fly.
- `fly-female-baseline`: the baseline female fly. Same shape as `fly-female`, different palette only (FR-016).
- `fly-male`: the normal male fly.
- `fly-male-baseline`: the baseline male fly. Same shape as `fly-male`, different palette only (FR-016).

`fly-female` and `fly-male` MAY differ in their non-transparent pixel shape from each other (sex is a shape difference, per
FR-021); within a sex, the normal and baseline sprites MUST have the same non-transparent pixels and differ only in palette
(FR-016). Which pair a fly uses is read from `flies.sex` (world config, open decision D4; replaces the single `flies.sprite`/
`flies.baselineSprite` pointing at one shape).

## 3. Look (FR-014, FR-021)

Drawn from above, head at the top, as the current fly is drawn:

- Head: small, with two large red compound eyes (palette `e`).
- Thorax: dark, with a short bristle line.
- Abdomen: round, tan or ochre (palette `t`), with dark bands (palette `k`). **Female** (`fly-female`,
  `fly-female-baseline`): longer abdomen, three or four evenly spaced bands reaching the tip. **Male** (`fly-male`,
  `fly-male-baseline`): shorter, more compact abdomen, ending in one solid dark band at the tip (reference:
  `fruit-fly.jpeg`, supplied by the reporter, used for proportions only and not committed to the repo).
- Wings: a pair, clear or pale (palette `w`), with a fine vein line, held out from the body and projecting laterally at
  roughly a right angle to the body's long axis — not swept back and not running parallel to the abdomen's sides (BUG-002:
  the previous art drew the wings as a border running the length of the body).
- Legs: six, dark, from the thorax.

## 4. Orientation

- Drawn unrotated, head up. The renderer does not rotate sprites. Heading is not shown (plan D2; spec FR-015 amended).

## 5. Tests

- `tests/fly-sprite.test.mjs`: all four sprites (`fly-female`, `fly-female-baseline`, `fly-male`, `fly-male-baseline`) have
  32 rows of 32 characters; every character is `.` or in the palette; within each sex, the normal and baseline sprites have
  the same non-transparent pixels and different palettes; `fly-female` and `fly-male` are allowed (expected) to have
  different non-transparent pixel shapes (BUG-002).
- Visual check: `quickstart.md` step 4, redone for all four sprites and the sex assignment (BUG-002).
