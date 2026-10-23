// Decoded-readout section (D31, ADR 010 Part E/K; contracts/decoder-v1.md). Mounted only for a "v3" fly (the
// 'decoder' signal fly-host.js adds to its capabilities). Shows, per declared sense: side, drive, trend, the
// declared valence and the pool size behind it — labelled "decoded readout" so a visitor sees this is a
// declared/decoded signal, not a hidden script (constitution VI). Each row also draws the side and drive as bars,
// the trend as a glyph, and the drive's recent history as a sparkline (viz.js).
import { setText, textEl } from '../dom.js';
import {
  buildBar, buildFillBar, buildSparkline, pushSample, sideFill, symmetricScale, trendGlyph,
} from '../viz.js';

const DECIMALS = 2;
const fmt = (v) => (v === undefined ? 'absent' : v.toFixed(DECIMALS));
// The drive scale never shrinks below this, so a silent sense does not blow up its own noise.
const DRIVE_FLOOR = 0.05;

// The neuron count behind one sense's readout: its drive pool plus both side pools, when they exist (Edge
// Case: a sense with no side pool still has a pool size from its drive pool alone).
function poolSize(pools, pair) {
  if (!pools) return undefined;
  const names = [`drive.${pair}`, `side.${pair}.L`, `side.${pair}.R`];
  return names.reduce((sum, name) => sum + (pools[name]?.length ?? 0), 0);
}

function vizRow(label, ...children) {
  const row = document.createElement('div');
  row.className = 'viz-row';
  row.appendChild(textEl('span', label));
  for (const child of children) row.appendChild(child);
  return row;
}

function renderSense(pair, sense, pools, driveHistory) {
  const row = document.createElement('div');
  row.className = 'decoder-row';
  row.appendChild(textEl('span', pair));
  row.appendChild(textEl('span',
    ` side ${fmt(sense.side)} · drive ${fmt(sense.drive)} · trend ${fmt(sense.trend)} `
    + `· ${sense.valence} · pool ${poolSize(pools, pair) ?? 'absent'}`));

  // Side: the track's left end is the left side, and the fill runs toward the stronger one (viz.js sideFill).
  // The fill takes the colour of the stronger side: left (blue token) when side is positive, right when negative.
  const side = buildFillBar({
    fill: sideFill(sense.side),
    fillClass: sense.side !== undefined && sense.side < 0 ? 'viz-fill-side-R' : 'viz-fill-side-L',
    label: `side ${fmt(sense.side)}`,
  });
  // Drive: zero is rest (decoder.js subtracts it), so the marker sits at zero on a symmetric scale.
  const scale = symmetricScale(driveHistory, DRIVE_FLOOR);
  const drive = buildBar({
    value: sense.drive, lo: -scale, hi: scale, marker: 0, fillClass: 'viz-fill-drive', label: `drive ${fmt(sense.drive)}`,
  });
  const glyph = trendGlyph(sense.trend);
  const trend = textEl('span', glyph.text);
  trend.className = glyph.cls;
  const history = buildSparkline(driveHistory, { lo: -scale, hi: scale, baseline: 0, label: `${pair} drive history` });

  const viz = document.createElement('div');
  viz.className = 'decoder-viz';
  viz.appendChild(vizRow('side', side));
  viz.appendChild(vizRow('drive', drive, trend));
  viz.appendChild(vizRow('history', history));
  const chip = textEl('span', sense.valence);
  chip.className = `valence-chip valence-${sense.valence}`;
  viz.appendChild(chip);
  row.appendChild(viz);
  return row;
}

export const decoderSection = {
  id: 'decoder',
  title: 'Decoded readout',
  requires: { signal: 'decoder' },
  mount(body, model) {
    const label = document.createElement('p');
    label.className = 'decoder-label';
    setText(label, 'Decoded readout (not learned)');
    const rows = document.createElement('div');
    rows.className = 'decoder-rows';
    body.replaceChildren(label, rows);

    // Drive history per sense pair, kept for this mount (one fly). Each update adds one sample per sense.
    const driveHistory = new Map();
    const update = (m) => {
      rows.replaceChildren();
      if (!m.decoded) return;
      for (const pair of Object.keys(m.decoded.senses).sort()) {
        const sense = m.decoded.senses[pair];
        if (!driveHistory.has(pair)) driveHistory.set(pair, []);
        const history = driveHistory.get(pair);
        pushSample(history, sense.drive);
        rows.appendChild(renderSense(pair, sense, m.decoderPools, history));
      }
    };
    update(model);
    return { update };
  },
};
