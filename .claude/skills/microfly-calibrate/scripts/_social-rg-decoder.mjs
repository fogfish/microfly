// One-off runner (T026, spec 020): the social-v3 C2 rule against rewire(socialSnapshot, 0x52470001), the
// random-graph null arm (Principle III, research R11/R13). Not part of the skill's own CLI surface — this
// mirrors calibrate.mjs's ctx-building for one profile/world, then swaps in the rewired snapshot before
// calling the same runC2 decoder-engine already used for the real brain, with the exact same LIF block and
// gates (including the noSidePairs finding from the real run). Writes
// public/brains/forager-brain-social.rg.decoder.json. Run once; not part of any npm script.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolveFlies } from '../../../../public/js/fly/fly-config.js';
import { validateConfig } from '../../../../public/js/world/validate.js';
import { parseSnapshot } from '../../../../public/js/brain/snapshot.js';
import { runC2, buildDecoderFile, rewire } from './decoder-engine.mjs';
import { profile } from './profiles/social-v3.mjs';

const webRoot = new URL('../../../../public/', import.meta.url);
const config = JSON.parse(readFileSync(new URL(profile.worldPath, webRoot), 'utf8'));
const expConfig = { ...config, flies: { ...config.flies, mode: 'toy' } };
const errors = validateConfig(expConfig);
if (errors.length > 0) {
  for (const { path, message } of errors) console.error(`${path}: ${message}`);
  process.exit(1);
}
const f = resolveFlies(expConfig);
const bytes = readFileSync(new URL(f.brain.snapshot, webRoot));
const realSnapshot = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const sha256 = createHash('sha256').update(bytes).digest('hex');

const rgSnapshot = rewire(realSnapshot, 0x52470001);
const ctx = { f: { ...f, brain: { ...f.brain, learning: undefined } }, snapshot: rgSnapshot, capabilities: rgSnapshot.capabilities };

// The real run's chosen C1 point. Side-pool selectivity on a fully rewired graph is not a meaningful
// comparison (a scrambled graph has no real structure to select on; reproducibility across the held-back
// seed is then down to chance, and the first attempt found exactly that: E-DECODE-side.reinforcement-
// reward.L, a pair unrelated to either social sense). T026 only needs the social pairs' drive-pool sizes
// and rises against the real brain's, so every declared pair skips side-pool selection here.
const lifBlock = { ...ctx.f.brain.lif, synapticScale: 5, baselineCurrent: 0 };
const allPairIds = [...new Set(rgSnapshot.capabilities.channels.inputs.map((ch) => ch.id.replace(/-(left|right)$/, '')))];
const gates = { ...profile.c2.gates, valence: profile.c2.valence, noSidePairs: allPairIds };

const c2 = runC2(ctx, lifBlock, gates);
if (c2.errors.length > 0) {
  console.log(`C2 (random graph) failed: ${c2.errors.join(', ')}`);
  process.exit(0);
}
for (const [name, members] of Object.entries(c2.pools)) {
  console.log(`  ${name.padEnd(30)} ${members.length} members, rest ${c2.homeostasisRest[name].toFixed(6)}`);
}

const configHash = createHash('sha256').update(JSON.stringify({ lif: lifBlock, c1: profile.c1 })).digest('hex');
const decoderFile = buildDecoderFile(c2, f.brain.snapshot, sha256, lifBlock, configHash);
decoderFile.provenance.arm = 'random-graph';
decoderFile.provenance.rewireSeed = '0x52470001';

const out = new URL('../../../../public/brains/forager-brain-social.rg.decoder.json', import.meta.url);
writeFileSync(out, JSON.stringify(decoderFile, null, 2));
console.log(`Written: ${out.pathname}`);
