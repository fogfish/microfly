// The mounted sections of the selected fly (BUG-002, panel-sections.md Lifecycle). Pure: the elements are
// made and removed through the `dom` callbacks, so the lifecycle can be tested without a browser.
//
// dom: { createBox(section) → body, removeBox(body), showText(body, text, isError) }
//
// sync(flyId, shown, model) is the structural render: it mounts what is new, disposes what is gone, and
// updates the rest. update(model) is the value update: it never mounts. clear() disposes every section,
// for example before the readout of another fly replaces the boxes. Every mount is disposed exactly once.

import { disposeSection, mountSection, updateSection } from './registry.js';

export function createSectionHost(dom) {
  // id → { section, body, mounted }; mounted is null for an unmet section or one in error
  let entries = new Map();
  let flyId = null;

  function fail(entry, error) {
    if (entry.mounted) disposeSection(entry.mounted);
    entry.mounted = null;
    dom.showText(entry.body, error, true);
  }

  function clear() {
    for (const entry of entries.values()) {
      if (entry.mounted) disposeSection(entry.mounted);
    }
    entries = new Map();
    flyId = null;
  }

  // shown: [{ section, met }] in registry order. met is false for a section that shows its `unmet` text.
  function sync(id, shown, model) {
    if (id !== flyId) clear();
    flyId = id;

    const keep = new Set(shown.map(({ section }) => section.id));
    for (const [key, entry] of entries) {
      if (keep.has(key)) continue;
      if (entry.mounted) disposeSection(entry.mounted);
      dom.removeBox(entry.body);
      entries.delete(key);
    }

    for (const { section, met } of shown) {
      const entry = entries.get(section.id);
      if (entry) {
        if (entry.mounted) {
          const result = updateSection(entry.mounted, model);
          if (!result.ok) fail(entry, result.error);
        }
        continue;
      }
      const created = { section, body: dom.createBox(section), mounted: null };
      entries.set(section.id, created);
      if (!met) {
        dom.showText(created.body, section.unmet, false);
        continue;
      }
      const result = mountSection(section, created.body, model);
      if (result.ok) created.mounted = result.mounted;
      else fail(created, result.error);
    }
  }

  function update(model) {
    for (const entry of entries.values()) {
      if (!entry.mounted) continue;
      const result = updateSection(entry.mounted, model);
      if (!result.ok) fail(entry, result.error);
    }
  }

  return {
    sync,
    update,
    clear,
    get flyId() {
      return flyId;
    },
  };
}
