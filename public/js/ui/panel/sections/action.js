// Action section: Forward, Turn left, Turn right, Backward, Idle or Eat, from the motor outputs (browser only).
// A forager fly also shows its energy and hunger as two bars (ADR 003 W1, FR-031) and the drives behind its action
// (FR-034).
import { setHidden, setText, textEl } from '../dom.js';
import { barWidth } from '../model.js';

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
    const drives = textEl('p', '');
    drives.className = 'drives';
    meters.append(energy.row, hunger.row);
    body.append(label, meters, drives);

    const update = (m) => {
      setText(label, m.action ?? 'Waiting for the first tick');
      const forager = m.energy !== null && m.energy !== undefined;
      setHidden(meters, !forager);
      setHidden(drives, !forager);
      if (!forager) return;
      energy.fill.style.width = barWidth(m.energy);
      hunger.fill.style.width = barWidth(m.hunger);
      const d = m.diagnostic;
      setText(drives, `Speed ${d.speed.toFixed(2)} tiles/s · Feed ${d.feed.toFixed(2)} · Forward ${d.forward.toFixed(2)}`
        + ` · Backward ${d.backward.toFixed(2)} · ${d.eating ? 'Eating' : 'Not eating'}`);
    };
    update(model);
    return { update };
  },
};
