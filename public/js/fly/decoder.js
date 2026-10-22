// decoder-v1 reader (contracts/decoder-v1.md, ADR 010 D27–D28) and the per-tick decode plus homeostatic baseline
// (D29, D33). Runs on the main thread, from fly-host.js's existing `motor` handler: this reads spikes already
// computed by the worker (motor decoding), not neural computation — Principle II holds. `flies.brain.version:
// "v3"` only.

const VALENCES = ['approach', 'avoid', 'none'];
// D29 names floor_p and ε but gives neither a value; fixed small constants local to this module. FLOOR keeps a
// silent pool's weight near zero without a special-case branch; EPSILON only guards a divide by zero.
const EPSILON = 1e-6;
const FLOOR = 0.02;
// D33: both channels of a pair below this are "quiet" for homeostasis purposes.
const QUIET_THRESHOLD = 0.05;
const DRIVE_TAU = 3;    // D29: drive_p's own smoothing
const SLOW_TAU = 30;    // D29: trend_p's slow EMA
const REST_TAU = 2000;  // D33: rest rate EMA

// ADR 011 (contracts/learning-v1.md "Addition to decoder-v1", data-model.md "Learned valence"). A food pair is
// one whose pair id starts with "odour-food" (the only senses this feature pairs with reward/punishment); every
// other sense's learned gain stays 1 (W13 untouched). Defaults match the C2 example when a decoder carries no
// `learning` block at all (not just a naive-less one).
const LEARN_TAU = 300;
const LEARN_K_DEFAULT = 2.0;
const isFoodPair = (pair) => pair.startsWith('odour-food');

// ---- reader (contracts/decoder-v1.md "Reader rules") ----

// Fetches and parses the decoder-v1 sidecar named by flies.brain.decoder. path: as given in world config, resolved
// against root exactly like flies.brain.snapshot (research.md §3). snapshot: { sha256, neuronCount, senses } of
// the already-loaded .brain file (senses: the declared sense/pair ids, for the "unknown pair" rule).
export async function loadDecoder(path, root, snapshot) {
  const url = new URL(path, root);
  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    throw new Error(`decoder ${path} could not be loaded (network error: ${e.message})`);
  }
  if (!response.ok) throw new Error(`decoder ${path} could not be loaded (HTTP ${response.status})`);
  let file;
  try {
    file = await response.json();
  } catch (e) {
    throw new Error(`decoder ${path} is not valid JSON: ${e.message}`);
  }
  return parseDecoder(file, path, snapshot);
}

// The pair a pool name declares, or null for a fixed-name pool (alarm/feed/forward/backward) that names none.
function poolPair(name) {
  const m = /^(?:side|drive)\.(.+?)(?:\.(?:L|R))?$/.exec(name);
  return m ? m[1] : null;
}

// Pure: validates an already-parsed decoder-v1 object against the four reader rules, in order, and returns
// { pools, valence, provenance }. Throws naming the file path and the problem (contracts/decoder-v1.md).
export function parseDecoder(file, path, snapshot) {
  const gotSha = file.snapshot?.sha256;
  if (gotSha !== snapshot.sha256) {
    throw new Error(`decoder ${path} was built for a different snapshot (expected ${snapshot.sha256}, got ${gotSha})`);
  }
  const pools = file.pools ?? {};
  for (const [name, members] of Object.entries(pools)) {
    for (const idx of members) {
      if (!(Number.isInteger(idx) && idx >= 0 && idx < snapshot.neuronCount)) {
        throw new Error(`decoder ${path} pool "${name}" has an out-of-range index`);
      }
    }
    const pair = poolPair(name);
    if (pair !== null && !snapshot.senses.includes(pair)) {
      throw new Error(`decoder ${path} names unknown pair "${pair}"`);
    }
  }
  // ADR 012 R12: a `song` pool only makes sense against a snapshot that declares a `song` output
  // (channel-declaration-v6); rejecting it here rather than silently reading an undefined drive.
  if ('song' in pools && !snapshot.hasSongOutput) {
    throw new Error(`decoder ${path}: song pool needs a snapshot song output`);
  }
  const valence = file.valence ?? {};
  for (const [sense, v] of Object.entries(valence)) {
    if (!VALENCES.includes(v)) throw new Error(`decoder ${path} has an invalid valence for "${sense}"`);
  }
  // ADR 011 (contracts/learning-v1.md "Addition to decoder-v1"): learning.naive keys are pair ids, checked with
  // the existing "unknown pair" rule.
  const learning = file.learning ?? {};
  for (const pair of Object.keys(learning.naive ?? {})) {
    if (!snapshot.senses.includes(pair)) throw new Error(`decoder ${path} names unknown pair "${pair}"`);
  }
  // ADR 012 R7: valenceSource (which claims.md row motivated a declared pair's valence) is documentation, not
  // behaviour — accepted and carried through for the panel/provenance, never required or validated against
  // `valence`'s own keys.
  return {
    pools, valence, learning, provenance: file.provenance ?? {}, homeostasis: file.homeostasis ?? { rest: {} },
    valenceSource: file.valenceSource ?? {},
  };
}

// ---- per-tick decode + homeostasis (D29, D33) ----

// The decoder's pair id (D26: "odour-food, odour-danger, heat, taste-mouth, taste-leg and touch, each L/R") is
// finer-grained than a channel's declared `sense` (channel-declaration-v5.md: taste-mouth and taste-leg both
// declare sense "taste", split only by `site`). Channel ids already carry the finer name
// ("taste-mouth-left"/"taste-leg-left"), so the pair id is the channel id with its "-left"/"-right" suffix
// stripped — generic over any future wide-io snapshot that follows the same id convention.
export function pairOf(channelId) {
  return channelId.replace(/-(left|right)$/, '');
}

// One state object per running v3 fly, seeded from the decoder file's own C2-measured rest rates (D33: "the fly
// behaves correctly from tick 0"). channels: capabilities.channels.inputs, in declaration order (matches the
// sense message's `inputs` array, and the echoed `inputs` on the motor message). mbon (ADR 011, optional):
// { approach, avoid } neuron-index arrays, resolved once by the caller (learning.js's resolveLearningGroups)
// against the same snapshot manifest the worker uses — null when the world declares no learning sidecar, which
// keeps every food pair's learned gain at 1 (learning off).
export function createDecoderState(decoder, channels, mbon = null) {
  const rest = { ...decoder.homeostasis.rest };
  for (const name of Object.keys(decoder.pools)) if (!(name in rest)) rest[name] = 0;
  return {
    rest,
    rate: {},   // per-pool EMA (τ=3) of the raw population rate r (D29: "rates … smoothed with τ = 3 ticks")
    drive: {},  // per-pair max(0, r̄ − rest), from the smoothed rate
    slow: {},   // per-pair EMA (τ=30) of drive, for trend
    channels: channels.map((ch) => ({ pair: pairOf(ch.id), side: ch.side })),
    mbon,
    learnApp: {}, learnAvoid: {},   // per food-pair EMA (τ=300) of the MBON approach/avoid group rate
    learnBaseline: {}, learnCount: {}, // the naive-balance fallback (first 300 ticks of presence)
  };
}

function groupRate(group, fired) {
  if (!group || group.length === 0) return 0;
  let count = 0;
  for (const i of group) if (fired.has(i)) count++;
  return count / group.length;
}

const ema = (prev, value, tau) => prev + (value - prev) / tau;

// Fraction of a pool's members present in this tick's fired-neuron set, or 0 for an absent/empty pool.
function rateOf(pools, fired, name) {
  const members = pools[name];
  if (!members || members.length === 0) return 0;
  let count = 0;
  for (const n of members) if (fired.has(n)) count++;
  return count / members.length;
}

// Every declared pair's quiet flag (D33: both its input channels below QUIET_THRESHOLD), plus whether every
// sense is quiet (used by the fixed-name pools alarm/feed/forward/backward).
function quietByPair(state, inputs) {
  const quiet = {};
  let allQuiet = true;
  const pairs = new Set(state.channels.map((c) => c.pair));
  for (const pair of pairs) {
    let pairQuiet = true;
    state.channels.forEach((c, k) => { if (c.pair === pair && inputs[k] >= QUIET_THRESHOLD) pairQuiet = false; });
    quiet[pair] = pairQuiet;
    if (!pairQuiet) allQuiet = false;
  }
  return { quiet, allQuiet };
}

// Updates state.rest[name] in place while quiet, and always returns the (possibly just-updated) rest value with
// the pool's smoothed rate r (D29, τ = 3). Smoothing comes before the rest subtraction, so a pool at rest decodes
// to drive ≈ 0: a 2–4 neuron pool's raw rate jumps 0 → 0.5 → 1 on one coincident spike, and read raw it fires
// escape/backing up on noise alone (spec 017 BUG-001). rest itself (τ = 2,000) still learns from the raw rate.
function restOf(state, pools, fired, name, quiet) {
  const raw = rateOf(pools, fired, name);
  if (!(name in pools)) return { r: raw, rest: 0 };
  if (quiet) state.rest[name] = ema(state.rest[name] ?? raw, raw, REST_TAU);
  const r = ema(state.rate[name] ?? raw, raw, DRIVE_TAU);
  state.rate[name] = r;
  return { r, rest: state.rest[name] ?? raw };
}

// One tick of decode. state: createDecoderState's return, mutated in place (D33's running rest/balance).
// tick: { spikes: Uint32Array, inputs: Float32Array } — the worker's spikes and the echoed sense inputs
// (protocol-v3's motor message already carries both). decoder: { pools, valence } (parseDecoder's return).
// Returns { senses: { [pair]: { drive, side, weight, trend, valence } }, named: { alarm, feed, forward, backward
// : { r, rest, drive } } }. A pair with no side pool exposes `side` as undefined (absent), never 0 with a lie
// attached (contracts/decoder-v1.md).
export function decodeTick(state, { spikes, inputs }, { pools, valence, learning }) {
  const fired = new Set(spikes);
  const { quiet, allQuiet } = quietByPair(state, inputs);

  const senses = {};
  for (const pair of Object.keys(valence)) {
    const pairQuiet = quiet[pair] ?? allQuiet;
    const { r: rDrive, rest: restDrive } = restOf(state, pools, fired, `drive.${pair}`, pairQuiet);
    const drive = Math.max(0, rDrive - restDrive);
    state.drive[pair] = drive;

    const prevSlow = state.slow[pair] ?? drive;
    const slow = ema(prevSlow, drive, SLOW_TAU);
    state.slow[pair] = slow;
    const trend = (drive - slow) / (slow + EPSILON);

    const weight = drive / (drive + FLOOR);

    const lName = `side.${pair}.L`;
    const rName = `side.${pair}.R`;
    let side;
    if (pools[lName] !== undefined && pools[rName] !== undefined) {
      const { r: rL, rest: restL } = restOf(state, pools, fired, lName, pairQuiet);
      const { r: rR, rest: restR } = restOf(state, pools, fired, rName, pairQuiet);
      // D33: b_p = slow(r(side.L)) / slow(r(side.R)) — "slow" here is the same rest-rate EMA; r̂(side.L) =
      // r(side.L) / b_p corrects L onto R's own scale, removing the rest turn bias.
      const balance = restR > 0 ? restL / restR : 1;
      const rHatL = balance > 0 ? rL / balance : rL;
      side = (rHatL - rR) / (rHatL + rR + EPSILON);
    }

    // ADR 011 (contracts/learning-v1.md, data-model.md "Learned valence"): a food pair's learned gain ℓ_p, from
    // an EMA (τ=300) of the MBON approach/avoid group rates, updated only while the pair is present (the same
    // "both channels < 0.05" gate D33 already computes as `quiet`). undefined (not 1) for a non-food pair, or
    // when the world declares no learning sidecar — body-layer.js's sumByValence treats undefined as 1.
    let learnedGain;
    if (state.mbon && isFoodPair(pair)) {
      if (!pairQuiet) {
        const rApp = groupRate(state.mbon.approach, fired);
        const rAvoid = groupRate(state.mbon.avoid, fired);
        state.learnApp[pair] = ema(state.learnApp[pair] ?? rApp, rApp, LEARN_TAU);
        state.learnAvoid[pair] = ema(state.learnAvoid[pair] ?? rAvoid, rAvoid, LEARN_TAU);
      }
      const rApp = state.learnApp[pair] ?? 0;
      const rAvoid = state.learnAvoid[pair] ?? 0;
      const bal = (rApp - rAvoid) / (rApp + rAvoid + EPSILON);

      const naive = learning?.naive?.[pair];
      let bal0;
      if (naive !== undefined) {
        bal0 = naive;
      } else {
        const seen = state.learnCount[pair] ?? 0;
        if (seen < LEARN_TAU && !pairQuiet) {
          const prevMean = state.learnBaseline[pair] ?? bal;
          state.learnBaseline[pair] = prevMean + (bal - prevMean) / (seen + 1);
          state.learnCount[pair] = seen + 1;
        }
        bal0 = state.learnBaseline[pair] ?? bal;
      }

      const kValence = learning?.kValence ?? LEARN_K_DEFAULT;
      learnedGain = Math.min(1.5, Math.max(0.5, 1 + kValence * (bal - bal0)));
    }

    senses[pair] = { drive, side, weight, trend, valence: valence[pair], learnedGain };
  }

  const named = {};
  for (const name of ['alarm', 'feed', 'forward', 'backward', 'song']) {
    if (!(name in pools)) continue;
    const { r, rest } = restOf(state, pools, fired, name, allQuiet);
    named[name] = { r, rest, drive: Math.max(0, r - rest) };
  }
  // D27 (as amended, A1/A3; spec 017 BUG-001, BUG-003): alarm's drive is the larger of the danger and heat drive
  // pools' drives when the brain has them; the union is the ADR 010 Part L fallback. A union's rate is a
  // member-weighted mean, so the 5-neuron danger pool was lost in it. Heat's tail is network-burst noise at τ = 3
  // (correlation 0.87), so the body layer integrates alarm over escape.tau before it triggers (body-layer.js).
  if (named.alarm) {
    const parts = ['odour-danger', 'heat'].filter((p) => senses[p] && `drive.${p}` in pools).map((p) => senses[p].drive);
    if (parts.length > 0) named.alarm.drive = Math.max(...parts);
  }
  // D30 (as amended, A2, spec 017 BUG-002): when the brain has a drive.taste-mouth pool, feed's drive is that pool's
  // drive; the named feed pool (MN9) is the fallback. In the 14.5K cut MN9 barely follows taste (decoded drive 0.032
  // off food vs 0.051 starving on food, any smoothing), so eating flickered for single ticks. The taste-mouth pool
  // is hunger-gated in the brain (D32's taste gain): P(drive ≥ 0.12) per tick is 0.10 sated, 0.76 hungry, 0.90
  // starving (calibration.md, 2026-10-17 eat probe).
  if (named.feed && senses['taste-mouth'] && 'drive.taste-mouth' in pools) {
    named.feed.drive = senses['taste-mouth'].drive;
  }

  return { senses, named };
}
