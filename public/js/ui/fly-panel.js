// Per-fly list and readout for the selected fly. Browser only.
// Text is set with textContent, so values from config or workers are never parsed as HTML.
// The list buttons are kept between renders, so keyboard focus survives the 20 Hz updates.

const WINDOW = 20; // ticks counted for telemetry spikes

const MODE_LABEL = {
  toy: 'toy (synthetic test fixture)',
  baseline: 'baseline (random walk, no brain)',
};

export function renderFlyPanel(container, records, selectedId, onSelect) {
  if (records.length === 0) {
    container.replaceChildren(textEl('p', 'No flies configured'));
    return;
  }

  let list = container.querySelector(':scope > ul');
  if (!list || list.children.length !== records.length) {
    list = document.createElement('ul');
    for (let i = 0; i < records.length; i++) {
      const li = document.createElement('li');
      li.append(document.createElement('button'));
      list.append(li);
    }
  }
  records.forEach((r, i) => {
    const btn = list.children[i].firstChild;
    btn.type = 'button';
    btn.textContent = `Fly ${r.state.id} · ${r.brainLabel ?? MODE_LABEL[r.state.mode]} · ${r.status} · contacts ${r.state.body.contacts}`;
    btn.setAttribute('aria-pressed', String(r.state.id === selectedId));
    btn.onclick = () => onSelect(r.state.id);
  });
  if (list.parentNode !== container) container.prepend(list);

  container.querySelector(':scope > .readout')?.remove();
  const selected = records.find((r) => r.state.id === selectedId);
  if (selected) container.append(readout(selected));
}

function readout(r) {
  const div = document.createElement('div');
  div.className = 'readout';
  div.append(textEl('h3', `Fly ${r.state.id}`));

  if (r.status === 'error') {
    div.append(textEl('p', `Error: ${r.error}`));
    return div;
  }

  const last = r.history.at(-1);
  if (!last) {
    div.append(textEl('p', 'Waiting for the first tick'));
  }

  const rows = document.createElement('dl');
  rows.append(
    ...pair('sensory', last ? last.sensory.toFixed(2) : '–'),
    ...pair('LEFT', last ? last.left.toFixed(2) : '–'),
    ...pair('RIGHT', last ? last.right.toFixed(2) : '–'),
  );

  if (r.state.mode === 'toy') {
    const recent = r.history.slice(-WINDOW);
    r.telemetry.forEach((neuron, k) => {
      const spikes = recent.reduce((sum, h) => sum + h.selected[k], 0);
      rows.append(...pair(`neuron ${neuron}`, `${spikes} spikes in last ${WINDOW} ticks`));
    });
  }
  div.append(rows);
  return div;
}

function pair(term, value) {
  const dt = textEl('dt', term);
  const dd = textEl('dd', value);
  return [dt, dd];
}

function textEl(tag, text) {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}
