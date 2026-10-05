// Outputs section: one centred row per declared output channel (browser only).
import { renderChannelRows } from '../channels.js';

export const outputsSection = {
  id: 'channels-output',
  title: 'Outputs',
  requires: { channels: 'outputs' },
  render(body, model) {
    renderChannelRows(body, model.outputs);
  },
};
