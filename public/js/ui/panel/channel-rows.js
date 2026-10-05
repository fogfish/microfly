// Pure helpers for the channel rows (specs/006-fly-status-panel/contracts/panel-sections.md, Channel rows).

// Items grouped by side. An item with side "both" is listed under L and under R.
// side is read from each item by the accessor, so rows ({ channel, value }) and channels both work.
export function groupBySide(items, side = (item) => item.side) {
  const groups = { L: [], R: [] };
  for (const item of items) {
    const s = side(item);
    if (s === 'L' || s === 'both') groups.L.push(item);
    if (s === 'R' || s === 'both') groups.R.push(item);
  }
  return groups;
}

// The value clamped to its range, as a fraction of the range, between 0 and 1.
export function barFraction(value, [min, max]) {
  const clamped = Math.min(max, Math.max(min, value));
  return (clamped - min) / (max - min);
}

// The centred bar (BUG-001, FR-017): zero is the centre of the row, so the value is clamped to
// [0, range max] and taken as a fraction of the range max. The declared minimum does not move the zero line.
export function centredFraction(value, [, max]) {
  const clamped = Math.min(max, Math.max(0, value));
  return clamped / max;
}
