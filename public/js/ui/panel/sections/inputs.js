// Inputs section: one centred row per declared input channel (browser only).
import { renderChannelRows } from '../channels.js';

export const inputsSection = {
  id: 'channels-input',
  title: 'Inputs',
  requires: { channels: 'inputs' },
  render(body, model) {
    renderChannelRows(body, model.inputs);
  },
};
