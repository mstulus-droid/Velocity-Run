// Two-language UI copy. Unchanged from the 2D build.

export const I18N = {
  id: {
    badge: 'RHADZOR ARCADE',
    tagline: 'Selap-selip di trafik 300+ km/j. Rangkai kombo near-miss,<br>isi nitro, dan tahan gas selama nyawamu kuat.',
    best: 'TERBAIK', play: 'MAIN', dist: 'JARAK', coins: 'KOIN', score: 'SKOR',
    steer: 'BELOK', steer2: 'HP: GESER', nitroK: 'NITRO', brake: 'REM',
    paused: 'JEDA', resume: 'LANJUT', backMenu: 'MENU', crashed: 'TABRAKAN!',
    newBest: '★ REKOR BARU ★', retry: 'LAGI', nearmiss: 'NEAR MISS',
    maxCombo: 'COMBO MAKS', topSpeed: 'TOP SPEED', graphics: 'GRAFIS',
  },
  en: {
    badge: 'RHADZOR ARCADE',
    tagline: 'Weave through 300+ km/h traffic. Chain near-miss combos,<br>charge your nitro, and hold the throttle.',
    best: 'BEST', play: 'PLAY', dist: 'DISTANCE', coins: 'COINS', score: 'SCORE',
    steer: 'STEER', steer2: 'TOUCH: DRAG', nitroK: 'NITRO', brake: 'BRAKE',
    paused: 'PAUSED', resume: 'RESUME', backMenu: 'MENU', crashed: 'CRASHED!',
    newBest: '★ NEW BEST ★', retry: 'RETRY', nearmiss: 'NEAR MISS',
    maxCombo: 'MAX COMBO', topSpeed: 'TOP SPEED', graphics: 'GRAPHICS',
  },
};

export const $ = (id) => document.getElementById(id);

export let LANG = localStorage.getItem('rhadzor-lang') || 'id';

export function applyLang() {
  document.querySelectorAll('[data-key]').forEach((el) => {
    const k = el.getAttribute('data-key');
    if (I18N[LANG][k] !== undefined) el.innerHTML = I18N[LANG][k];
  });
  $('langId').classList.toggle('on', LANG === 'id');
  $('langEn').classList.toggle('on', LANG === 'en');
  document.documentElement.lang = LANG;
}

export function setLang(l) {
  LANG = l;
  localStorage.setItem('rhadzor-lang', l);
  applyLang();
}
