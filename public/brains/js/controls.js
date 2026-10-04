// DOM controls for the inspector side panel. Values from the snapshot file are escaped before they
// are written as HTML; nothing from the file is used as markup.
import { ROLES, SOURCES } from './annotations.js';

const $ = (id) => document.getElementById(id);

export const LEVEL_LABEL = { region: 'Region', superclass: 'Superclass', class: 'Class', type: 'Type' };

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const field = (label, value) => `<div>${escapeHtml(label)}: <b>${escapeHtml(value ?? '—')}</b></div>`;

// Neuron details for the info panel (hover or pinned click).
export function neuronInfo(neuron) {
  const lines = [
    `<b>body ${escapeHtml(neuron.bodyId)}</b> <span class="pill">${escapeHtml(neuron.role)}</span>`,
    field('class', neuron.class),
    field('type', neuron.type),
    field('soma side', neuron.somaSide),
    field('transmitter', `${neuron.transmitter} (${Number(neuron.transmitterConfidence).toFixed(2)})`),
    field('sign', neuron.sign > 0 ? '+1 (excitatory)' : '−1 (inhibitory)'),
  ];
  if (neuron.superclass) lines.push(field('superclass', neuron.superclass));
  return lines.join('');
}

// Role description and note of a group, from the reference's ROLES (reference roleFor).
export function roleFor(level, name) {
  if (level === 'type') return { text: ROLES.type[name] || '', note: null };
  if (level === 'region') return { text: ROLES.region[name] || '', note: null };
  if (level === 'superclass') return { text: ROLES.superclass[name] || '', note: null };
  if (name.startsWith('(no class) ')) {
    const superclass = name.slice('(no class) '.length);
    return { text: ROLES.superclass[superclass] || '', note: `Unclassified: superclass ${superclass} only.` };
  }
  return { text: ROLES.class[name] || '', note: null };
}

const topList = (rows) => rows.length === 0
  ? '<li class="muted">none</li>'
  : rows.map(([name, synapses]) => `<li>${escapeHtml(name)} <span class="muted">${synapses.toLocaleString()}</span></li>`).join('');

// Group details for the info panel. `links` holds the largest outgoing and incoming groups.
export function groupInfo({ level, name, count, fromNeighbours, outgoing, incoming, synapsesOut, synapsesIn }) {
  const role = roleFor(level, name);
  return [
    `<b>${escapeHtml(name)}</b> <span class="pill">${escapeHtml(LEVEL_LABEL[level])}</span>`,
    `<div class="muted" style="margin-top:4px">bodies ${count.toLocaleString()}${fromNeighbours ? ' · placed by neighbours' : ''}</div>`,
    `<div class="muted">synapses out ${synapsesOut.toLocaleString()} · in ${synapsesIn.toLocaleString()}</div>`,
    `<p style="margin:6px 0">${escapeHtml(role.text || 'No description available.')}</p>`,
    role.note ? `<div class="muted">${escapeHtml(role.note)}</div>` : '',
    `<div class="muted">Largest outgoing targets:</div><ul>${topList(outgoing)}</ul>`,
    `<div class="muted">Largest incoming sources:</div><ul>${topList(incoming)}</ul>`,
  ].join('');
}

export function showInfo(html) {
  $('info').innerHTML = html;
}

export function renderCounts({ neuronsInFile, edgesInFile, neuronsDrawn, edgesDrawn }) {
  $('counts').innerHTML = [
    field('neurons in file', neuronsInFile.toLocaleString()),
    field('edges in file', edgesInFile.toLocaleString()),
    field('neurons drawn', neuronsDrawn.toLocaleString()),
    field('edges drawn', edgesDrawn.toLocaleString()),
  ].join('');
}

// Brain switcher, filled from the manifest labels.
export function renderSwitcher(brains, selected) {
  $('brain').replaceChildren(...brains.map(({ file, label }) => new Option(label, file, false, file === selected)));
}

export function bindBrainSwitch(onChange) {
  $('brain').addEventListener('change', (e) => onChange(e.target.value));
}

// The minimum-synapse slider runs on a log scale from 1 to 10,000 (value 0 to 100).
export const minSynapsesFromSlider = (value) => Math.max(1, Math.round(10 ** ((value / 100) * 4)));

// The reference's density slider: 1 to 100 per cent.
const densityFromSlider = (value) => Number(value) / 100;

// Level, connection mode and the Connections sliders. `mode` shows the top-edge slider in body mode.
// Returns the starting values.
export function bindConnections({ onLevel, onMode, onMinSynapses, onTopEdges }) {
  const minSlider = $('minSyn');
  const topSlider = $('topN');
  const show = () => {
    $('minSynV').textContent = minSynapsesFromSlider(minSlider.value).toLocaleString();
    $('topNv').textContent = Number(topSlider.value).toLocaleString();
  };
  minSlider.addEventListener('input', () => {
    show();
    onMinSynapses(minSynapsesFromSlider(minSlider.value));
  });
  topSlider.addEventListener('input', () => {
    show();
    onTopEdges(Number(topSlider.value));
  });
  document.querySelectorAll('input[name=level]').forEach((el) => el.addEventListener('change', () => onLevel(el.value)));
  document.querySelectorAll('input[name=mode]').forEach((el) => el.addEventListener('change', () => {
    $('topBlock').hidden = el.value !== 'body';
    onMode(el.value);
  }));
  show();
  $('topBlock').hidden = true;
  return {
    level: document.querySelector('input[name=level]:checked').value,
    mode: document.querySelector('input[name=mode]:checked').value,
    minSynapses: minSynapsesFromSlider(minSlider.value),
    topEdges: Number(topSlider.value),
  };
}

// Wires the Display controls. Each callback receives the new value.
export function bindDisplay({ onPoints, onEdges, onUnannotated, onDensity, onAutoRotate, onReset }) {
  $('points').addEventListener('change', (e) => onPoints(e.target.checked));
  $('edges').addEventListener('change', (e) => onEdges(e.target.checked));
  $('unann').addEventListener('change', (e) => onUnannotated(e.target.checked));
  const density = $('density');
  const showDensity = () => { $('densityV').textContent = `${density.value}%`; };
  density.addEventListener('input', () => {
    showDensity();
    onDensity(densityFromSlider(density.value));
  });
  showDensity();
  $('spin').addEventListener('change', (e) => onAutoRotate(e.target.checked));
  $('reset').addEventListener('click', () => onReset());
  return { density: densityFromSlider(density.value) };
}

// Groups legend: one checkbox per group, sorted by the caller. Rows: { name, colour, count, checked }.
export function renderLegend(rows, onToggle) {
  const el = $('legend');
  el.replaceChildren(...rows.map(({ name, colour, count, checked }) => {
    const row = document.createElement('label');
    row.className = 'opt';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = checked;
    box.addEventListener('change', () => onToggle(name, box.checked));
    const swatch = document.createElement('span');
    swatch.className = 'sw';
    swatch.style.background = colour;
    const label = document.createElement('span');
    label.textContent = name;
    const total = document.createElement('span');
    total.className = 'muted';
    total.textContent = count.toLocaleString();
    row.append(box, swatch, label, total);
    if (count === 0) row.classList.add('dim');
    return row;
  }));
}

export function bindLegendButtons({ onShowAll, onHideAll }) {
  $('grpAll').addEventListener('click', () => onShowAll());
  $('grpNone').addEventListener('click', () => onHideAll());
}

// Sources list for the role descriptions (copied from the reference, research R8).
export function renderSources() {
  $('sources').innerHTML = SOURCES
    .map(({ title, url }) => `<div><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(title)}</a></div>`)
    .join('');
}
