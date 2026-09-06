// Keyboard + touch state. Steering is read by the game loop; the one-shot keys
// (start, pause, mute) fire callbacks handed in by main.js.

import { clamp } from './config.js';
import { Snd } from './audio.js';
import { $ } from './i18n.js';

export const input = {
  left: false, right: false, boost: false, brake: false,
  touchId: null, touchStartX: 0, touchCurX: 0, boostTouch: false,
};

/** -1..1 steering from whichever device is being used. */
export function steerAxis() {
  let s = 0;
  if (input.left) s -= 1;
  if (input.right) s += 1;
  if (input.touchId !== null) s = clamp((input.touchCurX - input.touchStartX) / (innerWidth * 0.12), -1, 1);
  return clamp(s, -1, 1);
}

export function boostHeld() { return input.boost || input.boostTouch; }

export function initInput({ canvas, onStart, onTogglePause, onToggleMute }) {
  addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'ArrowUp' || e.code === 'KeyW') input.boost = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') input.brake = true;
    if (e.code === 'Space' || e.code === 'Enter') { Snd.ensure(); onStart(); }
    if (e.key === 'p' || e.key === 'P' || e.code === 'Escape') onTogglePause();
    if (e.key === 'm' || e.key === 'M') onToggleMute();
  });
  addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'ArrowUp' || e.code === 'KeyW') input.boost = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') input.brake = false;
  });

  canvas.addEventListener('pointerdown', (e) => {
    Snd.ensure();
    if (input.touchId === null) {
      input.touchId = e.pointerId;
      input.touchStartX = e.clientX;
      input.touchCurX = e.clientX;
    }
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerId === input.touchId) {
      input.touchCurX = e.clientX;
      $('touchHint').classList.remove('on');
    }
  });
  const endTouch = (e) => { if (e.pointerId === input.touchId) input.touchId = null; };
  addEventListener('pointerup', endTouch);
  addEventListener('pointercancel', endTouch);

  const btnNitro = $('btnNitro');
  btnNitro.addEventListener('pointerdown', (e) => { e.preventDefault(); input.boostTouch = true; });
  addEventListener('pointerup', () => { input.boostTouch = false; });
  addEventListener('pointercancel', () => { input.boostTouch = false; });
}
