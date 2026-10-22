// T049 (research.md R14): the social metrics on scripted two- and three-fly per-tick record arrays. Each
// fixture builds one focal fly's own records directly (nnDistance/nnHeading/nnAhead/nnSex, contactWith/Side/Sex,
// singing) rather than deriving them from positions, since that derivation is scripts/social-arms.mjs's job
// (tests/social-lesion.test.mjs and tests/slow/social-two-fly.test.mjs already cover the geometry it reads from).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nnMedian, timeNear, contactEvents, contactRate, contactDuration, followingIndex, songBouts, songPerContact,
  socialSummary,
} from '../public/js/fly/metrics.js';

function tick({ nn = null, heading = 0, contact = null, singing = false } = {}) {
  // A contacting fly is, almost by definition, also the nearest neighbour — default nn to "touching distance"
  // when the caller gives a contact but no explicit neighbour, so a contact tick is never miscounted as "alone".
  if (nn === null && contact !== null) nn = { distance: 0 };
  return {
    nnDistance: nn ? nn.distance : null,
    nnHeading: nn ? nn.heading : null,
    nnAhead: nn ? nn.ahead : null,
    nnSex: nn ? nn.sex : null,
    heading,
    contactWith: contact ? contact.id : null,
    contactSide: contact ? contact.side : null,
    contactSex: contact ? contact.sex : null,
    singing,
  };
}

test('nnMedian reads the median nnDistance, ignoring ticks with no live neighbour', () => {
  const records = [tick({ nn: { distance: 1 } }), tick(), tick({ nn: { distance: 3 } }), tick({ nn: { distance: 5 } })];
  assert.equal(nnMedian(records), 3);
  assert.equal(nnMedian([tick(), tick()]), null);
});

test('timeNear is the fraction of (valid) ticks at nnDistance <= 2 tiles', () => {
  const records = [
    tick({ nn: { distance: 1 } }), tick({ nn: { distance: 2 } }), tick({ nn: { distance: 3 } }), tick(),
  ];
  assert.equal(timeNear(records, 2), 2 / 3); // the null-neighbour tick is excluded from the denominator
  assert.equal(timeNear([tick(), tick()], 2), null);
});

test('contactEvents groups a run of the same contactWith id into one event, with onset/duration/side/otherSex', () => {
  const records = [
    tick(),
    tick({ contact: { id: 7, side: 'L', sex: 'female' } }),
    tick({ contact: { id: 7, side: 'L', sex: 'female' } }),
    tick(),
    tick({ contact: { id: 9, side: 'R', sex: 'male' } }),
  ];
  const events = contactEvents(records);
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], { onset: 1, duration: 2, otherId: 7, side: 'L', otherSex: 'female' });
  assert.deepEqual(events[1], { onset: 4, duration: 1, otherId: 9, side: 'R', otherSex: 'male' });
});

test('contactEvents closes a run still open at the end of the record', () => {
  const records = [tick(), tick({ contact: { id: 1, side: 'L', sex: 'female' } })];
  assert.deepEqual(contactEvents(records), [{ onset: 1, duration: 1, otherId: 1, side: 'L', otherSex: 'female' }]);
});

test('contactRate is contact-event onsets per simulated minute', () => {
  const tickHz = 20;
  const records = Array.from({ length: tickHz * 60 }, (_, t) => (
    t === 0 || t === 100 ? tick({ contact: { id: 1, side: 'L', sex: 'female' } }) : tick()
  ));
  // two separate onsets (t=0 opens one event of duration 1, since t=1 has no contact; t=100 opens a second)
  assert.equal(contactRate(records, tickHz), 2);
});

test('contactDuration is the mean event length in ticks', () => {
  const records = [
    tick({ contact: { id: 1, side: 'L', sex: 'female' } }),
    tick({ contact: { id: 1, side: 'L', sex: 'female' } }),
    tick({ contact: { id: 1, side: 'L', sex: 'female' } }),
    tick(),
    tick({ contact: { id: 2, side: 'R', sex: 'male' } }),
  ];
  assert.equal(contactDuration(records), (3 + 1) / 2);
});

test('followingIndex is near 1 for a follower directly behind a leader heading the same way', () => {
  // The neighbour is dead ahead (dx>0 along this fly's own heading 0) and shares the same heading: cos(0) = 1.
  const records = Array.from({ length: 50 }, () => tick({ nn: { distance: 1, heading: 0, ahead: true } }));
  assert.ok(followingIndex(records, 2) > 0.99);
});

test('followingIndex is near 0 on average for independent random headings', () => {
  let seed = 42;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const records = Array.from({ length: 5000 }, () => tick({
    nn: { distance: 1, heading: rand() * 2 * Math.PI, ahead: rand() < 0.5 },
  }));
  const idx = followingIndex(records, 2);
  assert.ok(Math.abs(idx) < 0.05, `expected near 0, got ${idx}`);
});

test('followingIndex is 0 (not negative-biased) on a tick where the neighbour is not ahead', () => {
  const records = [tick({ nn: { distance: 1, heading: Math.PI, ahead: false } })]; // would be cos(pi)=-1 if not zeroed
  assert.equal(followingIndex(records, 2), 0);
});

test('followingIndex excludes ticks beyond the radius or with no neighbour', () => {
  const records = [tick({ nn: { distance: 10, heading: 0, ahead: true } }), tick()];
  assert.equal(followingIndex(records, 2), null);
});

test('songBouts groups a run of singing ticks into one bout with onset and duration', () => {
  const records = [tick(), tick({ singing: true }), tick({ singing: true }), tick(), tick({ singing: true })];
  assert.deepEqual(songBouts(records), [{ onset: 1, duration: 2 }, { onset: 4, duration: 1 }]);
});

test('songPerContact: perContact counts song onsets during a contact event; perTickAlone normalises by alone-ticks', () => {
  const records = [
    tick({ contact: { id: 1, side: 'L', sex: 'female' }, singing: true }), // onset during contact -> perContact
    tick({ contact: { id: 1, side: 'L', sex: 'female' } }),
    tick(), // alone (no neighbour)
    tick({ singing: true }), // alone song onset
    tick(),
  ];
  const { perContact, perTickAlone } = songPerContact(records, 2);
  assert.equal(perContact, 1); // 1 song onset during the 1 contact event
  assert.equal(perTickAlone, 1 / 3); // 1 alone song onset over 3 alone ticks
});

test('songPerContact is null when there are no contact events or no alone ticks', () => {
  // A close neighbour on every tick: no contact event, and no "alone" tick either (nnDistance <= radius throughout).
  const records = Array.from({ length: 3 }, () => tick({ nn: { distance: 1 } }));
  assert.deepEqual(songPerContact(records, 2), { perContact: null, perTickAlone: null });
});

test('socialSummary pools per-fly metrics and splits by the other fly\'s sex tag', () => {
  const femaleNeighbourTicks = Array.from({ length: 10 }, () => tick({ nn: { distance: 1, heading: 0, ahead: true, sex: 'female' } }));
  const maleNeighbourTicks = Array.from({ length: 10 }, () => tick({ nn: { distance: 1, heading: 0, ahead: true, sex: 'male' } }));
  const flyA = { sex: 'male', records: [...femaleNeighbourTicks, ...maleNeighbourTicks] };
  const flyB = { sex: 'female', records: [...femaleNeighbourTicks] };

  const summary = socialSummary([flyA, flyB], { radius: 2, tickHz: 20 });
  assert.equal(summary.perFly.length, 2);
  assert.equal(summary.perFly[0].sex, 'male');
  assert.equal(summary.perFly[0].nnMedian, 1);

  // bySex.female pools every record (across both flies) whose neighbour is tagged female: flyA's first 10 + flyB's 10.
  assert.equal(summary.bySex.female.nnMedian, 1);
  assert.equal(summary.bySex.female.timeNear, 1);
  // bySex.male pools only flyA's second 10 ticks (flyB never sees a male neighbour in this fixture).
  assert.equal(summary.bySex.male.nnMedian, 1);
});
