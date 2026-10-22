// Decoded-readout section (D31, ADR 010 Part E/K; contracts/decoder-v1.md). Mounted only for a "v3" fly (the
// 'decoder' signal fly-host.js adds to its capabilities). Shows, per declared sense: side, drive, trend, the
// declared valence and the pool size behind it — labelled "decoded readout" so a visitor sees this is a
// declared/decoded signal, not a hidden script (constitution VI).
import { setText, textEl } from '../dom.js';

const DECIMALS = 2;
const fmt = (v) => (v === undefined ? 'absent' : v.toFixed(DECIMALS));

// The neuron count behind one sense's readout: its drive pool plus both side pools, when they exist (Edge
// Case: a sense with no side pool still has a pool size from its drive pool alone).
function poolSize(pools, pair) {
  if (!pools) return undefined;
  const names = [`drive.${pair}`, `side.${pair}.L`, `side.${pair}.R`];
  return names.reduce((sum, name) => sum + (pools[name]?.length ?? 0), 0);
}

function renderRows(container, decoded, pools, singing) {
  container.replaceChildren();
  if (!decoded) return;
  for (const pair of Object.keys(decoded.senses).sort()) {
    const sense = decoded.senses[pair];
    const row = document.createElement('p');
    row.className = 'decoder-row';
    row.appendChild(textEl('span', pair));
    row.appendChild(textEl('span',
      ` side ${fmt(sense.side)} · drive ${fmt(sense.drive)} · trend ${fmt(sense.trend)} `
      + `· ${sense.valence} · pool ${poolSize(pools, pair) ?? 'absent'}`));
    container.appendChild(row);
  }
  // W17 (ADR 012 R12): the song named pool, when the decoder declares one (channel-declaration-v6). `singing`
  // is the body layer's own integrator state (model.js), not derived from this tick's named.song alone.
  if (decoded.named.song) {
    const row = document.createElement('p');
    row.className = 'decoder-row';
    row.appendChild(textEl('span', 'song'));
    row.appendChild(textEl('span',
      ` r ${fmt(decoded.named.song.r)} · rest ${fmt(decoded.named.song.rest)} · drive ${fmt(decoded.named.song.drive)} `
      + `· pool ${pools?.song?.length ?? 'absent'} · ${singing ? 'singing' : 'quiet'}`));
    container.appendChild(row);
  }
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

    const update = (m) => renderRows(rows, m.decoded, m.decoderPools, m.singing);
    update(model);
    return { update };
  },
};
