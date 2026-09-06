// Procedural track: a ring of segments, each with a curve amount and a height.
// Identical generation to the 2D build, so a seed of luck aside, the tracks
// feel the same. Segment count is forced even so the ground grid texture wraps
// without a visible seam at the loop point.

import { SEGLEN, rnd, easeIn, easeInOut } from './config.js';

export const track = {
  segments: [],
  length: 0,
};

function lastY() {
  const s = track.segments;
  return s.length === 0 ? 0 : s[s.length - 1].y;
}

function addSegment(curve, y) {
  track.segments.push({
    index: track.segments.length,
    curve,
    y,          // height at the FAR end of this segment
    y0: lastY(),// height at the near end
    props: null,
  });
}

function addRoad(enter, hold, leave, curve, dy) {
  const startY = lastY();
  const endY = startY + dy * SEGLEN;
  const total = enter + hold + leave;
  for (let i = 0; i < enter; i++) addSegment(easeIn(0, curve, i / enter), easeInOut(startY, endY, i / total));
  for (let i = 0; i < hold; i++) addSegment(curve, easeInOut(startY, endY, (enter + i) / total));
  for (let i = 0; i < leave; i++) addSegment(easeInOut(curve, 0, i / leave), easeInOut(startY, endY, (enter + hold + i) / total));
}

export function buildTrack() {
  track.segments = [];
  addRoad(40, 40, 40, 0, 0);                       // opening straight
  const CHUNKS = 26;
  for (let i = 0; i < CHUNKS; i++) {
    const r = Math.random();
    if (r < 0.22) addRoad(35, 55, 35, 0, rnd(-40, 40));                                  // gentle hill
    else if (r < 0.5) addRoad(30, 50, 30, rnd(2, 4) * (Math.random() < 0.5 ? -1 : 1), rnd(-20, 20));
    else if (r < 0.72) addRoad(25, 35, 25, rnd(4, 6) * (Math.random() < 0.5 ? -1 : 1), 0); // hard curve
    else if (r < 0.88) {                                                                  // S-bend over a crest
      addRoad(30, 40, 30, rnd(1, 3), rnd(30, 70));
      addRoad(30, 40, 30, rnd(-3, -1), rnd(-70, -30));
    } else addRoad(50, 30, 50, 0, rnd(60, 110));                                          // big climb
  }
  addRoad(40, 40, 40, 0, -lastY() / SEGLEN);       // level back out for the loop
  if (track.segments.length % 2 === 1) addSegment(0, lastY()); // keep the count even

  track.length = track.segments.length * SEGLEN;

  // Roadside dressing. Kind + side only; the renderer decides how they look.
  track.segments.forEach((s, i) => {
    const props = [];
    if (i % 4 === 0) props.push({ side: i % 8 === 0 ? -1 : 1, kind: 'post' });
    if (i % 9 === 4) props.push({ side: i % 18 < 9 ? -1 : 1, kind: 'palm' });
    if (i % 13 === 7) props.push({ side: i % 26 < 13 ? -1 : 1, kind: 'sign' });
    s.props = props;
  });
  return track;
}

export function findSegment(z) {
  const s = track.segments;
  return s[Math.floor(z / SEGLEN) % s.length];
}

/** Road height at an absolute track position (game units), interpolated. */
export function heightAt(z) {
  const seg = findSegment(z);
  const pct = (z % SEGLEN) / SEGLEN;
  return seg.y0 + (seg.y - seg.y0) * pct;
}
