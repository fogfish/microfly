// DOM writes that happen only when the value changes (browser only). A value update (BUG-002, FR-019)
// rewrites nothing that is already shown, so the browser does not repaint unchanged text or attributes.

export function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

export function setAttr(el, name, value) {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

export function setHidden(el, hidden) {
  if (el.hidden !== hidden) el.hidden = hidden;
}

export function textEl(tag, text) {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}
