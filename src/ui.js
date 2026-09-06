// Everything that touches the DOM: HUD readouts, overlays, the flash on crash.

import { $ } from './i18n.js';

export const fmtDist = (m) => (m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.floor(m) + ' m');

export function show(id, on) { $(id).classList.toggle('on', on); }

export function hudOn(on) { $('hud').classList.toggle('on', on); }

export function setCombo(n) {
  const cb = $('combo');
  if (n <= 0) { cb.classList.remove('on'); return; }
  cb.textContent = 'COMBO ×' + n;
  cb.classList.remove('on');
  void cb.offsetWidth;           // restart the pop animation
  cb.classList.add('on');
}

export function setShield(on) { $('shieldIco').classList.toggle('on', on); }

export function updateHud({ dist, score, coins, kmh, nitro, boosting }) {
  $('hDist').textContent = fmtDist(dist);
  $('hScore').textContent = score;
  $('hCoins').textContent = '⬤ ' + coins;
  $('speedVal').innerHTML = Math.round(kmh) + ' <small>KM/H</small>';
  $('nitroFill').style.width = nitro + '%';
  const b = $('btnNitro');
  b.classList.toggle('boost', boosting);
  b.classList.toggle('ready', !boosting && nitro > 25);
}

export function flash() {
  const fl = $('flash');
  fl.style.transition = 'none';
  fl.style.opacity = 0.8;
  requestAnimationFrame(() => { fl.style.transition = 'opacity .6s'; fl.style.opacity = 0; });
}

export function showGameOver(s) {
  $('finalScore').textContent = s.score;
  $('finalBest').textContent = s.bestScore;
  $('finalDist').textContent = fmtDist(s.dist);
  $('finalCoins').textContent = s.coins;
  $('finalNM').textContent = s.nearMisses;
  $('finalCombo').textContent = '×' + s.maxCombo;
  $('finalTop').textContent = Math.round(s.topKmh) + ' km/h';
  $('vrNewBest').classList.toggle('on', s.isBest);
  show('overOv', true);
  hudOn(false);
  $('touchHint').classList.remove('on');
}
