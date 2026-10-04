// Shows config errors in #error-panel. Uses textContent only, so values from
// world.json are never parsed as HTML.

const panel = () => document.getElementById('error-panel');

export function showErrors(errors) {
  const heading = document.createElement('h2');
  heading.textContent = 'The world could not be loaded';

  const list = document.createElement('ul');
  for (const { path, message } of errors) {
    const item = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = path || 'world.json';
    item.append(code, document.createTextNode(`: ${message}`));
    list.append(item);
  }

  const el = panel();
  el.replaceChildren(heading, list);
  el.hidden = false;
}

export function hideErrors() {
  const el = panel();
  el.replaceChildren();
  el.hidden = true;
}
