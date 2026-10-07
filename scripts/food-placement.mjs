// Food placement search (specs/009-food-odour-recalibration research R2, BUG-001). Not part of the app: run it to
// reproduce the food coordinates in the world files. Usage: node scripts/food-placement.mjs [radius-per-tile]
// It checks geometry only (walkable cells, odour-free share, stranded cells). No brain or fly runs.
//
// BUG-001: one instance per size class reached only ~50% odour coverage; the target is now 60–70% coverage
// (30–40% odour-free). The search keeps the R2 base triple (one instance per kind, closest to 50% free under the
// old 30–70% band) and greedily adds further instances — of any kind, on any free walkable cell not already
// occupied by another instance — until the free share falls inside [0.30, 0.40]. Same-kind and cross-kind reaches
// MAY overlap (FR-020): overlap is no longer rejected, since the whole point of adding instances is for their
// odour to add up.
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic } from '../public/js/world/layout.js';
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL('../public/assets/atlas/catalog.json', import.meta.url), 'utf8')));
const base = JSON.parse(readFileSync(new URL('../public/world/world-forager.json', import.meta.url), 'utf8'));
const cfg = JSON.parse(JSON.stringify(base));
cfg.edibles = []; cfg.dangers = [];
cfg.scatter = cfg.scatter.map(s => ({...s, sprites: s.sprites.filter(id => !['jungle-plant-016','jungle-plant-017','jungle-bush-018'].includes(id))})).filter(s=>s.sprites.length);
const logic = buildLogic(cfg, catalog);
const { cols, rows, blocked } = logic;
const walk = (x,y) => blocked[y*cols+x]===0;
let W=0; for (let i=0;i<cols*rows;i++) if(!blocked[i]) W++;
console.log('grid', cols, rows, 'walkable', W, 'of', cols*rows);
// component analysis (4-connected) of walkable cells
const comp = new Int32Array(cols*rows).fill(-1); let nc=0; const sizes=[];
for (let i=0;i<cols*rows;i++){ if(blocked[i]||comp[i]>=0) continue; const st=[i]; comp[i]=nc; let n=0;
  while(st.length){const c=st.pop(); n++; const x=c%cols,y=(c/cols)|0;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy; if(nx<0||ny<0||nx>=cols||ny>=rows) continue; const j=ny*cols+nx; if(!blocked[j]&&comp[j]<0){comp[j]=nc; st.push(j);} } }
  sizes.push(n); nc++; }
console.log('walkable components', nc, 'sizes', sizes.sort((a,b)=>b-a).slice(0,6));
// odour: sum of linear falloff, capped at 1 (gain 1, max 1)
function evaluate(srcs){
  const odour = new Float32Array(cols*rows);
  for (const s of srcs) for (let y=0;y<rows;y++) for (let x=0;x<cols;x++){
    const d=Math.hypot(x+0.5-s.x, y+0.5-s.y); if(d<s.r) odour[y*cols+x]+= 1-d/s.r; }
  let free=0;
  for (let i=0;i<cols*rows;i++) if(!blocked[i]&&odour[i]===0) free++;
  // components holding odour
  const withOdour = new Set(); for (let i=0;i<cols*rows;i++) if(!blocked[i]&&odour[i]>0) withOdour.add(comp[i]);
  let stranded=0; for (let i=0;i<cols*rows;i++) if(!blocked[i]&&!withOdour.has(comp[i])) stranded++;
  return { freeShare: free/W, stranded, odour };
}
// overlap check used only for the R2 base triple (one instance per kind, kept distinct and non-overlapping, as
// research R2 chose it). Added instances (below) are not checked against this: they MAY overlap (FR-020).
const ok = (srcs)=>{ for(let i=0;i<srcs.length;i++) for(let j=i+1;j<srcs.length;j++){ if(Math.hypot(srcs[i].x-srcs[j].x,srcs[i].y-srcs[j].y) < srcs[i].r+srcs[j].r) return false;} return true; };
const sizeTiles = { large: 63/32, medium: 45/32, small: 32/32 };
const RADIUS = Number(process.argv[2] ?? 6);
const radius = { small: RADIUS*sizeTiles.small, medium: RADIUS*sizeTiles.medium, large: RADIUS*sizeTiles.large };
console.log('reach', radius);
// seeded, deterministic PRNG (linear congruential) so the search reproduces byte-identical output (constitution IV).
let seed=12345; const rnd=()=>{seed=(seed*1103515245+12345)>>>0; return seed/4294967296;};
const pick=()=>{ for(let k=0;k<1000;k++){const x=Math.floor(rnd()*cols), y=Math.floor(rnd()*rows); if(walk(x,y)) return {x:x+0.5,y:y+0.5}; } return null; };

// Phase 1 (research R2, unchanged): find the base triple, one instance per kind, closest to 50% free among
// placements that are mutually non-overlapping, strand nothing, and sit in the old 30–70% band.
let best=null, tried=0, feasible=0;
for (let t=0;t<40000;t++){
  const L=pick(), M=pick(), S=pick(); if(!L||!M||!S) continue; tried++;
  const srcs=[{...L,r:radius.large,kind:'large'},{...M,r:radius.medium,kind:'medium'},{...S,r:radius.small,kind:'small'}];
  if(!ok(srcs)) continue;
  const e=evaluate(srcs); if(e.stranded>0) continue;
  if(e.freeShare<0.30||e.freeShare>0.70) continue;
  feasible++;
  const score=Math.abs(e.freeShare-0.5);
  if(!best||score<best.score) best={score, freeShare:e.freeShare, srcs};
}
console.log('phase 1 (base triple): tried',tried,'feasible',feasible,'freeShare',best?.freeShare);

// Phase 2 (BUG-001): greedily add more instances — any kind, any free walkable cell not already taken by another
// instance — until the free share falls inside [0.30, 0.40] (60–70% coverage). Each step samples several
// candidates and keeps the one that lowers the free share the most (fastest route to the target, fewest
// instances). Overlap with existing instances is allowed (FR-020); only sharing an exact cell is forbidden (FR-008).
const KINDS = ['small', 'medium', 'large'];
const cellOf = (s) => Math.floor(s.y) * cols + Math.floor(s.x);
let srcs = best.srcs.map((s) => ({ ...s }));
const taken = new Set(srcs.map(cellOf));
const TARGET_LO = 0.30, TARGET_HI = 0.40;
let round = 0;
let share = evaluate(srcs).freeShare;
while (share > TARGET_HI) {
  let bestCandidate = null;
  for (let c = 0; c < 60; c++) {
    const kind = KINDS[round % KINDS.length];
    const p = pick();
    if (!p || taken.has(cellOf(p))) continue;
    const trial = [...srcs, { ...p, r: radius[kind], kind }];
    const e = evaluate(trial);
    if (e.stranded > 0) continue;
    if (!bestCandidate || e.freeShare < bestCandidate.freeShare) bestCandidate = { freeShare: e.freeShare, point: p, kind };
  }
  if (!bestCandidate) break; // no feasible candidate this round; stop rather than loop forever
  srcs.push({ ...bestCandidate.point, r: radius[bestCandidate.kind], kind: bestCandidate.kind });
  taken.add(cellOf(bestCandidate.point));
  share = bestCandidate.freeShare;
  round++;
  if (round > 200) break; // safety valve; the loop should reach the target well before this
}
const final = evaluate(srcs);
console.log('phase 2 (added instances): rounds', round, 'total instances', srcs.length, 'freeShare', final.freeShare, 'stranded', final.stranded);
const byKind = Object.fromEntries(KINDS.map((k) => [k, srcs.filter((s) => s.kind === k).length]));
console.log('instances per kind', byKind);

const result = {
  freeShare: final.freeShare,
  stranded: final.stranded,
  // x/y are the exact cell-centre points evaluate() used (cellIndex floors them, contract §1): world config stores
  // these centres directly (e.g. world-forager.json's shipped `10.5, 20.5`), not an offset value.
  edibles: srcs.map((s) => ({ kind: s.kind, x: +s.x.toFixed(2), y: +s.y.toFixed(2), reach: +s.r.toFixed(2) })),
};
console.log(JSON.stringify(result, null, 1));
