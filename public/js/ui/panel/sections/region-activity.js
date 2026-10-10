// Region activity section (ADR 006 L10; contracts/panel-sections-v2.md). requires: { groups: true }, so this
// mounts only for a v5 declaration (capabilities.groups non-empty) — never for mock/v0/v1. One row per declared
// region, in the fixed order input/output/al/vnc/dn/central: its label and the fraction of its neurons that
// spiked within the same rolling window (WINDOW_TICKS) the panel's global activity count already uses.
import { setText } from '../dom.js';

const LABELS = { input: 'Input', output: 'Output', al: 'Antennal lobe', vnc: 'VNC', dn: 'DNs', central: 'Central' };

function row(region) {
  const el = document.createElement('div');
  el.className = 'meter';
  const name = document.createElement('span');
  name.textContent = LABELS[region] ?? region;
  const fill = document.createElement('i');
  fill.style.width = '0%';
  const value = document.createElement('span');
  value.className = 'region-value';
  el.append(name, fill, value);
  return { el, fill, value, region };
}

export const regionActivitySection = {
  id: 'region-activity',
  title: 'Region activity',
  requires: { groups: true },
  mount(body, model) {
    const rows = new Map();
    const render = (m) => {
      const entries = m.regionActivity ?? [];
      for (const { region, fraction } of entries) {
        if (!rows.has(region)) {
          const r = row(region);
          rows.set(region, r);
          body.append(r.el);
        }
        const r = rows.get(region);
        const width = `${Math.round(fraction * 100)}%`;
        if (r.fill.dataset.width !== width) {
          r.fill.dataset.width = width;
          r.fill.style.width = width;
        }
        setText(r.value, fraction.toFixed(2));
      }
    };
    render(model);
    return { update: render };
  },
};
