// Action section: Forward, Turn left, Turn right, Backward, Idle or Eat, from the motor outputs (browser only).
// A forager fly also shows its energy and hunger as two bars (ADR 003 W1).
import { setHidden, setText, textEl } from '../dom.js';

const percent = (value) => `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;

function bar(label) {
  const row = document.createElement('div');
  row.className = 'meter';
  const name = textEl('span', label);
  const fill = document.createElement('i');
  fill.style.width = '0%';
  row.append(name, fill);
  return { row, fill };
}

export const actionSection = {
  id: 'action',
  title: 'Action',
  requires: {},
  // The label is written only when it changes (BUG-002).
  mount(body, model) {
    const label = textEl('div', '');
    const meters = document.createElement('div');
    const energy = bar('Energy');
    const hunger = bar('Hunger');
    meters.append(energy.row, hunger.row);
    body.append(label, meters);

    const update = (m) => {
      setText(label, m.action ?? 'Waiting for the first tick');
      const forager = m.energy !== null && m.energy !== undefined;
      setHidden(meters, !forager);
      if (!forager) return;
      energy.fill.style.width = percent(m.energy);
      hunger.fill.style.width = percent(m.hunger);
    };
    update(model);
    return { update };
  },
};
