// DOM part of the channel rows: one centred row per declared channel (browser only).
// The zero line is the middle of the track. An L bar grows left from it, an R bar grows right, and a
// "both" channel draws on each side (BUG-001, FR-017). Text is set with textContent, so labels from a
// declaration are never parsed as HTML.
//
// The rows are built once per fly (mountChannelRows) and their bars and numbers are then changed in place
// (updateChannelRows), so a refresh builds no element (BUG-002, FR-019).

import { centredFraction } from './channel-rows.js';
import { setText } from './dom.js';

// rows: [{ channel, value }]. The value is shown as the true number; the bar is clamped to the range.
export function mountChannelRows(container, rows) {
  container.replaceChildren(...rows.map(channelRow));
}

// Writes the bar widths and the numbers of rows built by mountChannelRows, only where they changed.
// The channel list of a fly is fixed by its declaration, so the rows match one to one.
export function updateChannelRows(container, rows) {
  if (container.children.length !== rows.length) {
    mountChannelRows(container, rows);
    return;
  }
  rows.forEach(({ channel, value }, i) => {
    const row = container.children[i];
    const width = barWidth(channel, value);
    for (const el of row.querySelectorAll('.channel-fill')) setWidth(el, width);
    setText(row.querySelector('.channel-value'), value.toFixed(2));
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

function channelRow({ channel, value }) {
  const row = document.createElement('div');
  row.className = 'channel-row';

  const label = document.createElement('span');
  label.className = 'channel-label';
  label.textContent = channel.label;

  const track = document.createElement('span');
  track.className = 'channel-bar';
  const width = barWidth(channel, value);
  if (channel.side === 'L' || channel.side === 'both') {
    track.append(fill('L', width, channel.side === 'both'));
  }
  if (channel.side === 'R' || channel.side === 'both') {
    track.append(fill('R', width, channel.side === 'both'));
  }

  const number = document.createElement('span');
  number.className = 'channel-value';
  number.textContent = value.toFixed(2);

  row.append(label, track, number);
  return row;
}

// One half of the track. side "L" is anchored at the centre and grows left; "R" grows right.
function fill(side, width, both) {
  const el = document.createElement('span');
  el.className = `channel-fill side-${side}${both ? ' both' : ''}`;
  setWidth(el, width);
  return el;
}
