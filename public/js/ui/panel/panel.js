// The fly status panel shell (specs/006-fly-status-panel/contracts/panel-sections.md). Two tabs (BUG-001,
// FR-016): "World" holds the fly list, "Fly" holds one box per section of the selected fly. Browser only.
// Text is set with textContent. The tab buttons, the list buttons and the section boxes are kept between
// renders, so focus survives the 20 Hz updates and a point cloud is not rebuilt on every tick.

import { buildStatusModel } from './model.js';
import { runSection, selectSections, unmetSections } from './registry.js';
import { TABS } from './tabs.js';

const TAB_LABELS = { world: 'World', fly: 'Fly' };

// tab is the active tab name; onTab(name) is called when a tab button is pressed.
export function renderPanel(container, records, selectedId, onSelect, sections, tab, onTab) {
  const { worldPane, flyPane } = ensureShell(container, tab, onTab);
  renderList(worldPane, records, selectedId, onSelect);
  renderFly(flyPane, records, selectedId, sections);
}

// The tab bar and the two panes are built once. The active tab is marked with aria-selected and the
// inactive pane is hidden.
function ensureShell(container, tab, onTab) {
  let bar = container.querySelector(':scope > [role="tablist"]');
  if (!bar) {
    bar = document.createElement('div');
    bar.setAttribute('role', 'tablist');
    bar.className = 'tabs';
    for (const name of TABS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.role = 'tab';
      btn.dataset.tab = name;
      btn.textContent = TAB_LABELS[name];
      bar.append(btn);
    }
    container.replaceChildren(bar, pane('world'), pane('fly'));
  }
  for (const btn of bar.children) {
    btn.setAttribute('aria-selected', String(btn.dataset.tab === tab));
    btn.onclick = () => onTab(btn.dataset.tab);
  }
  for (const name of TABS) {
    const el = container.querySelector(`:scope > [data-pane="${name}"]`);
    el.hidden = name !== tab;
  }
  return {
    worldPane: container.querySelector(':scope > [data-pane="world"]'),
    flyPane: container.querySelector(':scope > [data-pane="fly"]'),
  };
}

function pane(name) {
  const el = document.createElement('div');
  el.className = 'pane';
  el.dataset.pane = name;
  return el;
}

function renderList(container, records, selectedId, onSelect) {
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
    btn.textContent = `Fly ${r.state.id} · ${r.brainLabel} · ${r.status} · contacts ${r.state.body.contacts}`;
    btn.setAttribute('aria-pressed', String(r.state.id === selectedId));
    btn.onclick = () => onSelect(r.state.id);
  });
  if (list.parentNode !== container) container.prepend(list);
}

function renderFly(container, records, selectedId, sections) {
  const selected = records.find((r) => r.state.id === selectedId);
  if (!selected) {
    container.replaceChildren(textEl('p', 'Select a fly in the world or in the list'));
    return;
  }

  let readout = container.querySelector(':scope > .readout');
  if (!readout || readout.dataset.flyId !== String(selected.state.id)) {
    readout = readoutFor(selected);
    container.replaceChildren(readout);
  }

  if (selected.status === 'error') {
    readout.querySelectorAll(':scope > [data-section]').forEach((box) => box.remove());
    readout.append(textEl('p', `Error: ${selected.error}`));
    return;
  }

  const model = buildStatusModel(selected, performance.now());
  const drawn = selectSections(sections, selected.capabilities);
  const absent = unmetSections(sections, selected.capabilities);
  const shown = sections.filter((s) => drawn.includes(s) || absent.includes(s));

  for (const box of readout.querySelectorAll(':scope > [data-section]')) {
    if (!shown.some((s) => s.id === box.dataset.section)) box.remove();
  }
  for (const section of shown) {
    const body = bodyFor(readout, section);
    if (!drawn.includes(section)) {
      body.textContent = section.unmet;
      continue;
    }
    const result = runSection(section, body, model);
    body.classList.toggle('error', !result.ok);
    if (!result.ok) body.textContent = result.error;
  }
}

function readoutFor(record) {
  const div = document.createElement('div');
  div.className = 'readout';
  div.dataset.flyId = String(record.state.id);
  div.append(textEl('h3', `Fly ${record.state.id}`), textEl('p', record.brainLabel));
  return div;
}

// The box of one section: heading and body. Reused between renders.
function bodyFor(readout, section) {
  let box = readout.querySelector(`:scope > [data-section="${section.id}"]`);
  if (!box) {
    box = document.createElement('section');
    box.className = 'panel-box';
    box.dataset.section = section.id;
    box.append(textEl('h4', section.title), document.createElement('div'));
    readout.append(box);
  }
  box.lastElementChild.className = 'panel-body';
  return box.lastElementChild;
}

function textEl(tag, text) {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}
