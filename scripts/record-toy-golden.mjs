// Records the toy golden trace (tests/fixtures/toy-golden.json) from the current LIF core.
// Run once, before any change to public/js/brain/lif.js. Do not re-run after the CSR refactor:
// the committed trace is the reference the refactor must match.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runToyGolden } from '../tests/golden-drive.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'tests', 'fixtures', 'toy-golden.json');

const trace = runToyGolden();
writeFileSync(out, `${JSON.stringify(trace)}\n`);
const spikes = trace.selected.filter((s) => s.some(Boolean)).length;
console.log(`wrote ${out}: ${trace.left.length} ticks, ${spikes} ticks with a telemetry spike`);
