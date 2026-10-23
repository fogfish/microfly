// Bars, markers, sparklines and trend glyphs for the decoder and learning sections (ADR 010 Part E/K, ADR 011
// Phase 8). The geometry is pure and tested in Node; the builders are browser only. Every bar and line shows a
// value that the section also prints as text, so the numbers stay readable and the picture shows the change.
// Values are data: each is clamped to its scale before it is drawn.

const SVG_NS = 'http://www.w3.org/2000/svg';

// Samples kept per sparkline. The panel updates every PANEL_INTERVAL_MS (200 ms), so 120 samples is about 24 s.
export const HISTORY_LENGTH = 120;
// |trend| below this reads as flat. A display threshold only; it does not change the decoder's values.
export const TREND_FLAT = 0.05;
// Sparkline drawing box, in SVG user units (scaled to the panel width by CSS).
const SPARK_W = 120;
const SPARK_H = 24;

// Appends a sample, dropping the oldest once the history is full. An absent value (undefined, null) is not a
// sample, so a missing signal leaves a gap in time rather than a fabricated point.
export function pushSample(history, value) {
  if (value === undefined || value === null) return;
  history.push(value);
  if (history.length > HISTORY_LENGTH) history.splice(0, history.length - HISTORY_LENGTH);
}

// Position of value on the scale [lo, hi] as a percentage of the track, clamped to the track.
export function percentAt(value, lo, hi) {
  const t = (value - lo) / (hi - lo);
  return Math.min(100, Math.max(0, t * 100));
}

// The filled part of a bar: from the marker to the value. Without a marker the fill starts at the left end.
export function barFill(value, lo, hi, marker = lo) {
  const from = percentAt(marker, lo, hi);
  const to = percentAt(value, lo, hi);
  return { left: Math.min(from, to), width: Math.abs(to - from) };
}

// The side bar: side is (L − R) / (L + R), so a positive value means the left side is stronger. The track's
// left end is the left side, so the fill runs toward the stronger side. Undefined (no side pool) has no fill.
export function sideFill(side) {
  if (side === undefined || side === null) return undefined;
  return barFill(-side, -1, 1, 0);
}

// Half-width of a symmetric scale: the largest magnitude seen, never below floor. Keeps small signals visible.
export function symmetricScale(values, floor) {
  let m = floor;
  for (const v of values) m = Math.max(m, Math.abs(v));
  return m;
}

// Sparkline points for the SVG polyline. The newest sample is at the right edge and the line grows leftward
// from there, so a short history does not stretch across the box.
export function sparklinePoints(values, { width = SPARK_W, height = SPARK_H, lo, hi }) {
  const n = values.length;
  return values
    .map((v, i) => {
      const x = ((HISTORY_LENGTH - n + i) / (HISTORY_LENGTH - 1)) * width;
      const clamped = Math.min(hi, Math.max(lo, v));
      const y = height - ((clamped - lo) / (hi - lo)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

// The trend glyph for a relative trend (drive against its slow average): rising, falling, or flat.
export function trendGlyph(trend) {
  if (trend === undefined || trend === null) return { text: '', cls: 'trend-absent' };
  if (trend > TREND_FLAT) return { text: '▲', cls: 'trend-up' };
  if (trend < -TREND_FLAT) return { text: '▼', cls: 'trend-down' };
  return { text: '–', cls: 'trend-flat' };
}

// --- DOM builders (browser only) ---

// A track with an optional marker, and a fill from the marker to the value. Absent values draw an empty, dashed
// track, so "absent" reads differently from a fill of zero.
export function buildBar({ value, lo, hi, marker, fillClass = '', label }) {
  const track = document.createElement('div');
  track.className = 'viz-bar';
  if (label) track.setAttribute('aria-label', label);
  if (value === undefined || value === null) {
    track.className += ' viz-absent';
    return track;
  }
  const fill = document.createElement('div');
  fill.className = `viz-fill ${fillClass}`.trim();
  const { left, width } = barFill(value, lo, hi, marker);
  fill.style.left = `${left}%`;
  fill.style.width = `${width}%`;
  track.appendChild(fill);
  if (marker !== undefined) {
    const mark = document.createElement('div');
    mark.className = 'viz-marker';
    mark.style.left = `${percentAt(marker, lo, hi)}%`;
    track.appendChild(mark);
  }
  return track;
}

// A bar drawn from a precomputed fill (sideFill). Same look as buildBar, with the centre line as the marker.
export function buildFillBar({ fill, fillClass, label }) {
  const track = document.createElement('div');
  track.className = 'viz-bar';
  if (label) track.setAttribute('aria-label', label);
  if (!fill) {
    track.className += ' viz-absent';
    return track;
  }
  const el = document.createElement('div');
  el.className = `viz-fill ${fillClass}`;
  el.style.left = `${fill.left}%`;
  el.style.width = `${fill.width}%`;
  track.appendChild(el);
  const mark = document.createElement('div');
  mark.className = 'viz-marker';
  mark.style.left = '50%';
  track.appendChild(mark);
  return track;
}

// A sparkline of the history on the fixed scale [lo, hi]. An optional baseline draws a dashed reference line.
export function buildSparkline(values, { lo, hi, baseline, label }) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'viz-spark');
  svg.setAttribute('viewBox', `0 0 ${SPARK_W} ${SPARK_H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  if (label) svg.setAttribute('aria-label', label);
  if (baseline !== undefined) {
    const y = SPARK_H - ((baseline - lo) / (hi - lo)) * SPARK_H;
    const ref = document.createElementNS(SVG_NS, 'line');
    ref.setAttribute('class', 'viz-spark-ref');
    ref.setAttribute('x1', '0');
    ref.setAttribute('x2', String(SPARK_W));
    ref.setAttribute('y1', y.toFixed(1));
    ref.setAttribute('y2', y.toFixed(1));
    svg.appendChild(ref);
  }
  if (values.length > 0) {
    const line = document.createElementNS(SVG_NS, 'polyline');
    line.setAttribute('points', sparklinePoints(values, { lo, hi }));
    svg.appendChild(line);
  }
  return svg;
}
