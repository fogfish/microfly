// Action section: Forward, Turn left, Turn right or Idle, from the motor outputs (browser only).
import { setText } from '../dom.js';

export const actionSection = {
  id: 'action',
  title: 'Action',
  requires: {},
  // The label is written only when it changes (BUG-002).
  mount(body, model) {
    const update = (m) => setText(body, m.action ?? 'Waiting for the first tick');
    update(model);
    return { update };
  },
};
