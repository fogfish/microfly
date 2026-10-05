// Tab state of the fly status panel (specs/006-fly-status-panel/spec.md, FR-016). Pure: no DOM.
// "world" lists the flies; "fly" shows the selected fly's status.

export const TABS = ['world', 'fly'];
export const initialTab = 'world';

// event: { type: "select" } when a fly is chosen, or { type: "tab", tab } when a tab button is pressed.
// A selection moves to the Fly tab. An unknown tab name leaves the tab where it is.
export function nextTab(current, event) {
  if (event.type === 'select') return 'fly';
  if (event.type === 'tab' && TABS.includes(event.tab)) return event.tab;
  return current;
}
