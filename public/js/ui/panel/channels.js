// DOM part of the channel rows: one centred row per signal (browser only).
// The zero line is the middle of the track. An L bar grows left from it, an R bar grows right, and a
// "both" channel draws on each side (BUG-001, FR-017). An L channel and its R partner share one row
// (pairRows, channel-rows.js), so the two sides read against the same zero line. Text is set with
// textContent, so labels from a declaration are never parsed as HTML.
//
// The rows are built once per fly (mountChannelRows) and their bars and numbers are then changed in place
// (updateChannelRows), so a refresh builds no element (BUG-002, FR-019).

import { centredFraction, pairRows } from './channel-rows.js';
import { setText } from './dom.js';

// rows: [{ channel, value }]. The value is shown as the true number; the bar is clamped to the range.
export function mountChannelRows(container, rows) {
  container.replaceChildren(...pairRows(rows).map(channelRow));
}

// Writes the bar widths and the numbers of rows built by mountChannelRows, only where they changed.
// The channel list of a fly is fixed by its declaration, so the groups match the rows one to one.
export function updateChannelRows(container, rows) {
  const groups = pairRows(rows);
  if (container.children.length !== groups.length) {
    mountChannelRows(container, rows);
    return;
  }
  groups.forEach((group, i) => {
    const row = container.children[i];
    group.parts.forEach((part, k) => {
      const width = barWidth(part.channel, part.value);
      for (const el of row.querySelectorAll(`[data-part="${k}"]`)) setWidth(el, width);
    });
    const { left, right } = numberText(group);
    setText(row.querySelector('.value-L'), left);
    setText(row.querySelector('.value-R'), right);
  });
}

// The width last written is kept on the element: the browser may normalise style.width ("12.0%" → "12%"),
// so comparing with it would rewrite the width on every refresh.
function setWidth(el, width) {
  if (el.dataset.width === width) return;
  el.dataset.width = width;
  el.style.width = width;
}

function barWidth(channel, value) {
  return `${(centredFraction(value, channel.range ?? [0, 1]) * 50).toFixed(1)}%`;
}

// The numbers beside the bar: the L value at the left end, the R value at the right end, no side letters.
// A paired row has both; a lone L or R channel fills its own end; a "both" channel shows its one value at the right.
function numberText(group) {
  const text = (part) => part.value.toFixed(2);
  if (group.parts.length === 2) {
    return { left: text(group.parts[0]), right: text(group.parts[1]) };
  }
  const [part] = group.parts;
  return part.side === 'L' ? { left: text(part), right: '' } : { left: '', right: text(part) };
}

function channelRow(group) {
  const row = document.createElement('div');
  row.className = 'channel-row';

  const label = document.createElement('span');
  label.className = 'channel-label';
  label.textContent = group.label;

  const track = document.createElement('span');
  track.className = 'channel-bar';
  group.parts.forEach((part, k) => {
    const width = barWidth(part.channel, part.value);
    if (part.side === 'L' || part.side === 'both') {
      track.append(fill('L', width, part.side === 'both', k));
    }
    if (part.side === 'R' || part.side === 'both') {
      track.append(fill('R', width, part.side === 'both', k));
    }
  });

  const { left, right } = numberText(group);
  const leftNumber = document.createElement('span');
  leftNumber.className = 'channel-value value-L';
  leftNumber.textContent = left;

  const rightNumber = document.createElement('span');
  rightNumber.className = 'channel-value value-R';
  rightNumber.textContent = right;

  row.append(label, leftNumber, track, rightNumber);
  return row;
}

// One half of the track. side "L" is anchored at the centre and grows left; "R" grows right.
// part is the index of the group part the fill belongs to, so an update finds it again.
function fill(side, width, both, part) {
  const el = document.createElement('span');
  el.className = `channel-fill side-${side}${both ? ' both' : ''}`;
  el.dataset.part = String(part);
  setWidth(el, width);
  return el;
}
