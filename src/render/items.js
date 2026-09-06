// Coins and pickups: small pools of spinning emissive meshes, assigned each
// frame to whatever the game state says is on the road.

import * as THREE from 'three';
import { ROADW, SEGLEN, ROAD_ROWS, COL } from '../config.js';

const VISIBLE_DZ = (ROAD_ROWS - 8) * SEGLEN;
import { sample, rowForDz } from './path.js';
import { wrapDz } from '../game.js';

const COIN_R = ROADW * 0.075 * 2;   // matches the 2D sprite's radius on screen

export class Items {
  constructor(scene) {
    this.scene = scene;
    const coinGeo = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_R * 0.22, 22);
    coinGeo.rotateX(Math.PI / 2);      // flat face towards the camera
    const coinMat = new THREE.MeshPhongMaterial({ color: 0xffd75e, emissive: 0xd99a00, emissiveIntensity: 0.9, shininess: 120, specular: 0xffffff });
    this.coins = [];
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.visible = false;
      scene.add(m); this.coins.push(m);
    }

    const R = ROADW * 0.10 * 2;
    const nitroMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(COL.cyan).multiplyScalar(1.9), toneMapped: false });
    const shieldMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(COL.green).multiplyScalar(1.7), toneMapped: false });
    const shellMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35, toneMapped: false });
    this.pickups = [];
    for (let i = 0; i < 3; i++) {
      const nitro = new THREE.Group();
      nitro.add(new THREE.Mesh(new THREE.OctahedronGeometry(R * 0.8), nitroMat));
      nitro.add(new THREE.Mesh(new THREE.OctahedronGeometry(R * 1.25), shellMat));
      const shield = new THREE.Group();
      shield.add(new THREE.Mesh(new THREE.IcosahedronGeometry(R * 0.75, 0), shieldMat));
      shield.add(new THREE.Mesh(new THREE.IcosahedronGeometry(R * 1.2, 1), shellMat));
      nitro.visible = shield.visible = false;
      scene.add(nitro, shield);
      this.pickups.push({ nitro, shield });
    }
  }

  update(G, t) {
    let ci = 0;
    for (const c of G.coins) {
      if (ci >= this.coins.length) break;
      const dz = wrapDz(c.z);
      if (dz < -SEGLEN * 2 || dz > VISIBLE_DZ) continue;
      const m = this.coins[ci++];
      const p = sample(rowForDz(dz), c.x, 42 + COIN_R * 1.35 + Math.sin(t * 4 + c.z * 0.01) * COIN_R * 0.35, ROADW);
      m.position.set(p.x, p.y, p.z);
      m.rotation.set(0, p.heading + t * 3 + c.spin, 0);
      m.visible = true;
    }
    for (; ci < this.coins.length; ci++) this.coins[ci].visible = false;

    let pi = 0;
    for (const slot of this.pickups) { slot.nitro.visible = false; slot.shield.visible = false; }
    for (const pk of G.pickups) {
      if (pi >= this.pickups.length) break;
      const dz = wrapDz(pk.z);
      if (dz < -SEGLEN * 2 || dz > VISIBLE_DZ) continue;
      const slot = this.pickups[pi++];
      const obj = pk.kind === 'nitro' ? slot.nitro : slot.shield;
      const p = sample(rowForDz(dz), pk.x, 42 + ROADW * 0.2 + Math.sin(t * 3 + pk.z * 0.01) * 80, ROADW);
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.set(t * 0.9, t * 1.6, 0);
      obj.visible = true;
    }
  }
}
