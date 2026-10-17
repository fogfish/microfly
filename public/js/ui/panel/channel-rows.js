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

// The left/right token of a channel id: "odour-food-left", "left-motor", "turn-right".
const SIDE_TOKEN = /(^|-)(left|right)(?=-|$)/;
// The left/right word of a label: "Food odour left", "Left motor".
const SIDE_WORD = /\s*\b(left|right)\b\s*/i;

// Pairs the L and R channels of one signal into one row (the panel draws them on the same centred row).
// The pair key is the id with its left/right token removed, so "odour-food-left" and "odour-food-right" share
// "odour-food". A channel with side "both", or with no partner, stays alone under its own id.
// rows: [{ channel, value }] in declaration order. Returns [{ label, parts: [{ side, channel, value }] }] in the
// order of the first member of each group; a paired row lists its L part before its R part.
export function pairRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const { channel } = row;
    const token = (channel.side === 'L' || channel.side === 'R') ? SIDE_TOKEN.exec(channel.id) : null;
    const key = token ? channel.id.replace(SIDE_TOKEN, '$1').replace(/^-|-$/g, '') : channel.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].map((members) => {
    const sideOf = (row) => row.channel.side;
    const left = members.find((row) => sideOf(row) === 'L');
    const right = members.find((row) => sideOf(row) === 'R');
    if (left && right && members.length === 2) {
      const label = left.channel.label.replace(SIDE_WORD, ' ').trim();
      return {
        label: label.charAt(0).toUpperCase() + label.slice(1),
        parts: [
          { side: 'L', channel: left.channel, value: left.value },
          { side: 'R', channel: right.channel, value: right.value },
        ],
      };
    }
    return {
      label: members[0].channel.label,
      parts: members.map(({ channel, value }) => ({ side: channel.side, channel, value })),
    };
  });
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
