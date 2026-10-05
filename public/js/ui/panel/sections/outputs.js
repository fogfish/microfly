// Outputs section: one centred row per declared output channel (browser only).
import { mountChannelRows, updateChannelRows } from '../channels.js';

export const outputsSection = {
  id: 'channels-output',
  title: 'Outputs',
  requires: { channels: 'outputs' },
  // Rows are built once per fly; a refresh changes their bars and numbers in place (BUG-002).
  mount(body, model) {
    mountChannelRows(body, model.outputs);
    return { update: (m) => updateChannelRows(body, m.outputs) };
  },
};
