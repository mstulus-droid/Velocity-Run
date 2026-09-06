// Small geometry helpers shared by the mesh builders.

import * as THREE from 'three';

/** Rotate then translate a geometry in place; returns it for chaining. */
export function placed(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz);
  geo.translate(x, y, z);
  return geo;
}

/**
 * Concatenate geometries that share one material into a single non-indexed
 * geometry (position + normal + uv). The inputs are disposed.
 */
export function concat(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of parts) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let off = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, off * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, off * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, off * 2);
    off += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  for (const g of geos) g.dispose();
  for (const g of parts) if (!geos.includes(g)) g.dispose();
  return out;
}
