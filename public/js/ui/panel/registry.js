// Section registry for the fly status panel (specs/006-fly-status-panel/contracts/panel-sections.md). Pure.
// A section declares what it requires from the brain's declaration, and renders into its own box.
// A section that is not selected is not drawn. A section that throws shows its error in its box only.

// True when the declaration has what the section needs. {} means the section always applies.
export function isRequirementMet(requires, capabilities) {
  if (requires.channels !== undefined) {
    return capabilities.channels[requires.channels]?.length > 0;
  }
  if (requires.signal !== undefined) {
    return capabilities.signals.includes(requires.signal);
  }
  return true;
}

// The sections to draw for this declaration, in registry order.
export function selectSections(sections, capabilities) {
  return sections.filter((section) => isRequirementMet(section.requires, capabilities));
}

// Sections that are not drawn, but have a message to show in their place (for example "no spike signal").
export function unmetSections(sections, capabilities) {
  return sections.filter((section) => section.unmet !== undefined && !isRequirementMet(section.requires, capabilities));
}

// Runs one section's render in its own try/catch. Returns { ok: true } or { ok: false, error }.
// The error names the section title, so the user can see which part failed.
export function runSection(section, container, model) {
  try {
    section.render(container, model);
    return { ok: true };
  } catch (e) {
    const error = `${section.title}: ${e.message}`;
    console.error(error, e);
    return { ok: false, error };
  }
}
