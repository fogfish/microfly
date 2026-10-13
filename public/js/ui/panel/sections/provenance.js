// Brain provenance section (specs/012-class-seeded-forager-brain contracts/panel-provenance-signals.md):
// selection strategy, admission rule and synapse threshold, plus the fidelity probe's pass/fail state and a
// toggle revealing its full table — only the rows the model actually has. Mounted only when the derived
// "provenance" signal is present; every brain without it (mock, v0, the shipped v1 forager) is unaffected.
import { setText } from '../dom.js';

const ROW_LABELS = { selection: 'Selection', admission: 'Admission', minSynapses: 'Synapse threshold' };

function renderRows(container, provenance) {
  container.replaceChildren();
  for (const key of ['selection', 'admission', 'minSynapses']) {
    const value = provenance?.[key];
    if (value === undefined || value === null) continue;
    const row = document.createElement('p');
    row.className = 'provenance-row';
    setText(row, `${ROW_LABELS[key]}: ${value}`);
    container.appendChild(row);
  }
}

function renderFidelity(container, fidelity) {
  container.replaceChildren();
  if (!fidelity) return;
  const pass = Boolean(fidelity.steering?.pass && fidelity.feeding?.pass);
  const summary = document.createElement('p');
  summary.className = 'provenance-fidelity';
  setText(summary, `Fidelity probe: ${pass ? 'pass' : 'FAIL'}`);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'provenance-fidelity-toggle';
  setText(toggle, 'Show table');

  const table = document.createElement('pre');
  table.className = 'provenance-fidelity-table';
  table.hidden = true;
  setText(table, JSON.stringify(fidelity.table, null, 2));

  toggle.addEventListener('click', () => {
    table.hidden = !table.hidden;
    setText(toggle, table.hidden ? 'Show table' : 'Hide table');
  });

  container.replaceChildren(summary, toggle, table);
}

export const provenanceSection = {
  id: 'provenance',
  title: 'Brain provenance',
  requires: { signal: 'provenance' },
  mount(body, model) {
    const rows = document.createElement('div');
    rows.className = 'provenance-rows';
    const fidelity = document.createElement('div');
    fidelity.className = 'provenance-fidelity-box';
    body.replaceChildren(rows, fidelity);

    const update = (m) => {
      renderRows(rows, m.provenance);
      renderFidelity(fidelity, m.fidelity);
    };
    update(model);
    return { update };
  },
};
