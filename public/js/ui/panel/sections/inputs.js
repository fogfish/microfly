// Inputs section: one centred row per declared input channel (browser only).
import { mountChannelRows, updateChannelRows } from '../channels.js';

export const inputsSection = {
  id: 'channels-input',
  title: 'Inputs',
  requires: { channels: 'inputs' },
  // Rows are built once per fly; a refresh changes their bars and numbers in place (BUG-002).
  mount(body, model) {
    mountChannelRows(body, model.inputs);
    return { update: (m) => updateChannelRows(body, m.inputs) };
  },
};
