// The fly status panel shell (specs/006-fly-status-panel/contracts/panel-sections.md). Two tabs (BUG-001,
// FR-016): "World" holds the Layers box (arcade ON/OFF switches and the odour legend, specs/007-odor-layer
// contracts/odour-layer.md §7) above the fly list; "Fly" holds one box per section of the selected fly. Browser only.
// Text is set with textContent. The tab buttons, the list buttons and the section boxes are kept between
// renders, so focus survives the periodic refreshes and a point cloud is not rebuilt on every tick.
//
// Two entry points (BUG-002, FR-019): renderPanel is the structural render (selection, tab, layer, status
// change); updatePanelValues is the value update of the periodic refresh, which builds no element. The
// sections of the selected fly are mounted once and disposed once (lifecycle.js, FR-020).

import { buildStatusModel } from './model.js';
import { selectSections, unmetSections } from './registry.js';
import { createSectionHost } from './lifecycle.js';
import { setAttr, setHidden, setText, textEl } from './dom.js';
import { TABS } from './tabs.js';
import { LAYERS } from '../../world/layers.js';

// Per Fly pane: the section host and what the last render showed ({ host, status, tick }).
const flyViews = new WeakMap();

const TAB_LABELS = { world: 'World', fly: 'Fly' };

// tab is the active tab name; onTab(name) is called when a tab button is pressed.
// view: { layers, onLayer(id), legend: { max } | null } drives the Layers box of the World tab.
export function renderPanel(
  container,
  records,
  selectedId,
  onSelect,
  sections,
  tab,
  onTab,
  view = { layers: {}, onLayer: () => {}, legend: null },
) {
  const { worldPane, flyPane } = ensureShell(container, tab, onTab);
  renderLayers(worldPane, view);
  renderList(worldPane.querySelector(':scope > [data-list]'), records, selectedId, onSelect);
  renderFly(flyPane, records, selectedId, sections);
}

// The value update (FR-012, FR-019): refreshes the fly list text and, when the selected fly has a new
// tick, the values of its mounted sections. It creates and removes no element. Returns false when a
// structural render is needed instead (the selected fly's status changed), so the caller can run one.
export function updatePanelValues(container, records, selectedId) {
  const worldPane = container.querySelector(':scope > [data-pane="world"]');
  const flyPane = container.querySelector(':scope > [data-pane="fly"]');
  if (!worldPane || !flyPane) return false;
  refreshList(worldPane.querySelector(':scope > [data-list]'), records, selectedId);

  const view = flyViews.get(flyPane);
  const selected = records.find((r) => r.state.id === selectedId);
  if (!view || !selected) return true;
  if (selected.status !== view.status) return false;
  if (selected.status === 'error') return true;
  if (view.host.flyId !== selected.state.id) return false;

  const tick = lastTick(selected);
  if (tick === view.tick) return true;
  view.tick = tick;
  view.host.update(buildStatusModel(selected, performance.now()));
  return true;
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
    const world = pane('world');
    const layers = document.createElement('section');
    layers.className = 'panel-box layers';
    const list = document.createElement('div');
    list.dataset.list = '';
    world.append(layers, list);
    container.replaceChildren(bar, world, pane('fly'));
  }
  for (const btn of bar.children) {
    setAttr(btn, 'aria-selected', String(btn.dataset.tab === tab));
    btn.onclick = () => onTab(btn.dataset.tab);
  }
  for (const name of TABS) {
    const el = container.querySelector(`:scope > [data-pane="${name}"]`);
    setHidden(el, name !== tab);
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

// The Layers box: one arcade switch per layer, then the odour legend. Built once, updated in place.
function renderLayers(worldPane, view) {
  const box = worldPane.querySelector(':scope > .layers');
  if (!box.firstChild) {
    box.append(textEl('h4', 'Layers'));
    for (const { id, label } of LAYERS) {
      const row = document.createElement('div');
      row.className = 'layer-row';
      row.dataset.layer = id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'arcade-switch';
      btn.setAttribute('role', 'switch');
      btn.setAttribute('aria-label', `${label} layer`);
      const name = textEl('span', label.toUpperCase());
      name.className = 'layer-label';
      row.append(name, btn);
      box.append(row);
    }
    box.append(legendEl());
  }

  // Writes happen only when a value changes, so a render does not repaint the switch and the legend.
  for (const row of box.querySelectorAll(':scope > .layer-row')) {
    const id = row.dataset.layer;
    const on = Boolean(view.layers[id]);
    const btn = row.querySelector('.arcade-switch');
    setAttr(btn, 'aria-checked', String(on));
    setText(btn, on ? 'ON' : 'OFF');
    btn.onclick = () => view.onLayer(id);
  }

  // The legend shows the ramp from 0 to the sensed maximum, only while the odour layer is on (FR-012).
  const legend = box.querySelector(':scope > .odour-legend');
  setHidden(legend, !view.layers.odour);
  const empty = view.legend === null;
  for (const el of legend.querySelectorAll('.legend-min, .legend-ramp, .legend-max')) setHidden(el, empty);
  setHidden(legend.querySelector('.legend-empty'), !empty);
  if (!empty) {
    setText(legend.querySelector('.legend-min'), '0');
    setText(legend.querySelector('.legend-max'), view.legend.max.toFixed(1));
  }
}

function legendEl() {
  const legend = document.createElement('div');
  legend.className = 'odour-legend';
  legend.hidden = true;
  const min = textEl('span', '0');
  min.className = 'legend-min';
  const ramp = document.createElement('span');
  ramp.className = 'legend-ramp';
  const max = textEl('span', '');
  max.className = 'legend-max';
  const empty = textEl('p', 'No odour sources in this world');
  empty.className = 'legend-empty';
  legend.append(min, ramp, max, empty);
  return legend;
}

// container is the [data-list] element of the World pane.
function renderList(container, records, selectedId, onSelect) {
  if (records.length === 0) {
    showMessage(container, 'No flies configured');
    return;
  }

  let list = container.querySelector(':scope > ul');
  if (!list || list.children.length !== records.length) {
    list = document.createElement('ul');
    for (let i = 0; i < records.length; i++) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      li.append(btn);
      list.append(li);
    }
  }
  records.forEach((r, i) => {
    const btn = list.children[i].firstChild;
    setText(btn, `Fly ${r.state.id} · ${r.brainLabel} · ${r.status} · contacts ${r.state.body.contacts}`);
    setAttr(btn, 'aria-pressed', String(r.state.id === selectedId));
    btn.onclick = () => onSelect(r.state.id);
  });
  if (list.parentNode !== container) container.replaceChildren(list);
}

// The list text of a value update: status and contacts change, the buttons stay.
function refreshList(container, records, selectedId) {
  const list = container.querySelector(':scope > ul');
  if (!list || list.children.length !== records.length) return;
  records.forEach((r, i) => {
    const btn = list.children[i].firstChild;
    setText(btn, `Fly ${r.state.id} · ${r.brainLabel} · ${r.status} · contacts ${r.state.body.contacts}`);
    setAttr(btn, 'aria-pressed', String(r.state.id === selectedId));
  });
}

function renderFly(container, records, selectedId, sections) {
  const view = viewFor(container);
  const selected = records.find((r) => r.state.id === selectedId);
  if (!selected) {
    view.host.clear();
    view.status = null;
    showMessage(container, 'Select a fly in the world or in the list');
    return;
  }

  // Another fly: its sections are disposed before the readout that holds them is replaced.
  let readout = container.querySelector(':scope > .readout');
  if (!readout || readout.dataset.flyId !== String(selected.state.id)) {
    view.host.clear();
    readout = readoutFor(selected);
    container.replaceChildren(readout);
  }
  view.status = selected.status;
  view.tick = lastTick(selected);

  if (selected.status === 'error') {
    view.host.clear();
    readout.querySelectorAll(':scope > [data-section]').forEach((box) => box.remove());
    let error = readout.querySelector(':scope > .fly-error');
    if (!error) {
      error = textEl('p', '');
      error.className = 'fly-error';
      readout.append(error);
    }
    setText(error, `Error: ${selected.error}`);
    return;
  }

  const model = buildStatusModel(selected, performance.now());
  const drawn = selectSections(sections, selected.capabilities);
  const absent = unmetSections(sections, selected.capabilities);
  const shown = sections
    .filter((s) => drawn.includes(s) || absent.includes(s))
    .map((section) => ({ section, met: drawn.includes(section) }));
  view.host.sync(selected.state.id, shown, model);
}

// The section host of a Fly pane. Its boxes go into the pane's current readout.
function viewFor(container) {
  let view = flyViews.get(container);
  if (view) return view;
  const host = createSectionHost({
    createBox(section) {
      const box = document.createElement('section');
      box.className = 'panel-box';
      box.dataset.section = section.id;
      const body = document.createElement('div');
      body.className = 'panel-body';
      box.append(textEl('h4', section.title), body);
      container.querySelector(':scope > .readout').append(box);
      return body;
    },
    removeBox(body) {
      body.parentElement?.remove();
    },
    showText(body, text, isError) {
      body.classList.toggle('error', isError);
      body.replaceChildren();
      body.textContent = text;
    },
  });
  view = { host, status: null, tick: undefined };
  flyViews.set(container, view);
  return view;
}

function lastTick(record) {
  return record.history.at(-1)?.tick;
}

function readoutFor(record) {
  const div = document.createElement('div');
  div.className = 'readout';
  div.dataset.flyId = String(record.state.id);
  div.append(textEl('h3', `Fly ${record.state.id}`), textEl('p', record.brainLabel));
  return div;
}

// Replaces the container's content with one paragraph, only when that paragraph is not already shown.
function showMessage(container, text) {
  const shown = container.children.length === 1 && container.firstElementChild.tagName === 'P';
  if (!shown || container.firstElementChild.textContent !== text) container.replaceChildren(textEl('p', text));
}
