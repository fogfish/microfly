// Inputs section: one centred row per declared input channel (browser only). ADR 012 R9/R8: a header line
// above the rows shows the fly's sex tag and which other fly its front-leg contact is currently reading,
// on a world that declares either; the row labels themselves carry each sense's valence (model.js).
import { setHidden, setText } from '../dom.js';
import { mountChannelRows, updateChannelRows } from '../channels.js';

export function socialLine(m) {
  if (m.sexLabel === undefined && m.contactWith === undefined) return null;
  const parts = [];
  if (m.sexLabel !== undefined) parts.push(`sex: ${m.sexLabel}`);
  if (m.contactWith !== undefined) parts.push(`touching: ${m.contactWith === null ? 'none' : `fly ${m.contactWith}`}`);
  return parts.join(' · ');
}

export const inputsSection = {
  id: 'channels-input',
  title: 'Inputs',
  requires: { channels: 'inputs' },
  // Rows are built once per fly; a refresh changes their bars and numbers in place (BUG-002).
  mount(body, model) {
    const social = document.createElement('p');
    social.className = 'inputs-social';
    const rows = document.createElement('div');
    body.append(social, rows);
    mountChannelRows(rows, model.inputs);
    const update = (m) => {
      const line = socialLine(m);
      setHidden(social, line === null);
      if (line !== null) setText(social, line);
      updateChannelRows(rows, m.inputs);
    };
    update(model);
    return { update };
  },
};
