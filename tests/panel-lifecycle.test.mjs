// Section lifecycle of the panel (BUG-002, FR-019, FR-020): one mount per fly, one dispose per mount,
// and a value update never mounts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSectionHost } from '../public/js/ui/panel/lifecycle.js';

// A fake section that counts its lifecycle calls.
function counting(id, log, { failUpdate = false } = {}) {
  return {
    id,
    title: id,
    requires: {},
    unmet: `${id} unmet`,
    mount(body, model) {
      log.push(`mount ${id} ${model.flyId}`);
      return {
        update(m) {
          if (failUpdate) throw new Error('bad');
          log.push(`update ${id} ${m.flyId}`);
        },
        dispose() {
          log.push(`dispose ${id}`);
        },
      };
    },
  };
}

function fakeDom() {
  const boxes = [];
  const texts = new Map();
  return {
    boxes,
    texts,
    createBox(section) {
      const body = { id: section.id };
      boxes.push(body);
      return body;
    },
    removeBox(body) {
      boxes.splice(boxes.indexOf(body), 1);
    },
    showText(body, text, isError) {
      texts.set(body.id, { text, isError });
    },
  };
}

const count = (log, prefix) => log.filter((l) => l.startsWith(prefix)).length;

test('select A, update 10 times, select B, clear: one mount per fly, one dispose per mount', () => {
  const log = [];
  const dom = fakeDom();
  const host = createSectionHost(dom);
  const map = counting('map', log);
  const shown = [{ section: map, met: true }];

  host.sync(1, shown, { flyId: 1 });
  for (let i = 0; i < 10; i++) host.update({ flyId: 1 });
  host.sync(2, shown, { flyId: 2 });
  host.clear();

  assert.equal(count(log, 'mount map 1'), 1);
  assert.equal(count(log, 'mount map 2'), 1);
  assert.equal(count(log, 'update'), 10);
  assert.equal(count(log, 'dispose map'), 2);
  assert.deepEqual(log.at(-1), 'dispose map');
});

test('a structural render of the same fly updates the mounted section and does not mount it again', () => {
  const log = [];
  const host = createSectionHost(fakeDom());
  const shown = [{ section: counting('action', log), met: true }];

  host.sync(1, shown, { flyId: 1 });
  host.sync(1, shown, { flyId: 1 });

  assert.deepEqual(log, ['mount action 1', 'update action 1']);
});

test('the old fly is disposed before the new fly is mounted', () => {
  const log = [];
  const host = createSectionHost(fakeDom());
  const shown = [{ section: counting('map', log), met: true }];

  host.sync(1, shown, { flyId: 1 });
  host.sync(2, shown, { flyId: 2 });

  assert.deepEqual(log, ['mount map 1', 'dispose map', 'mount map 2']);
});

test('an unmet section shows its text and is never mounted', () => {
  const log = [];
  const dom = fakeDom();
  const host = createSectionHost(dom);

  host.sync(1, [{ section: counting('map', log), met: false }], { flyId: 1 });
  host.update({ flyId: 1 });

  assert.deepEqual(log, []);
  assert.deepEqual(dom.texts.get('map'), { text: 'map unmet', isError: false });
});

test('an error in update disposes the section, shows the error, and the other sections keep updating', () => {
  const log = [];
  const dom = fakeDom();
  const host = createSectionHost(dom);
  const shown = [
    { section: counting('broken', log, { failUpdate: true }), met: true },
    { section: counting('action', log), met: true },
  ];

  host.sync(1, shown, { flyId: 1 });
  host.update({ flyId: 1 });
  host.update({ flyId: 1 });
  host.clear();

  assert.equal(count(log, 'dispose broken'), 1);
  assert.equal(count(log, 'update action'), 2);
  assert.deepEqual(dom.texts.get('broken'), { text: 'broken: bad', isError: true });
});

test('a section dropped from the shown set is disposed and its box removed', () => {
  const log = [];
  const dom = fakeDom();
  const host = createSectionHost(dom);
  const action = counting('action', log);
  const map = counting('map', log);

  host.sync(1, [{ section: action, met: true }, { section: map, met: true }], { flyId: 1 });
  host.sync(1, [{ section: action, met: true }], { flyId: 1 });

  assert.equal(count(log, 'dispose map'), 1);
  assert.deepEqual(dom.boxes.map((b) => b.id), ['action']);
});
