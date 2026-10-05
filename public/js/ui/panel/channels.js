// DOM part of the channel rows: one centred row per declared channel (browser only).
// The zero line is the middle of the track. An L bar grows left from it, an R bar grows right, and a
// "both" channel draws on each side (BUG-001, FR-017). Text is set with textContent, so labels from a
// declaration are never parsed as HTML.

import { centredFraction } from './channel-rows.js';

// rows: [{ channel, value }]. The value is shown as the true number; the bar is clamped to the range.
export function renderChannelRows(container, rows) {
  container.replaceChildren(...rows.map(channelRow));
}

function channelRow({ channel, value }) {
  const row = document.createElement('div');
  row.className = 'channel-row';

  const label = document.createElement('span');
  label.className = 'channel-label';
  label.textContent = channel.label;

  const track = document.createElement('span');
  track.className = 'channel-bar';
  const width = `${(centredFraction(value, channel.range ?? [0, 1]) * 50).toFixed(1)}%`;
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
  el.style.width = width;
  return el;
}
