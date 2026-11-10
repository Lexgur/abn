/** Button beeps (Web Audio) + looping CC0 dungeon ambience (OGG). */
const AudioBus = (() => {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let musicEl = null;
  let musicPct = 70;
  let sfxPct = 55;
  let started = false;
  let unlocking = null;

  const MOVE = {
    left: 247,
    right: 330,
    up: 392,
    down: 294,
    'hundred-up': 523,
    'hundred-down': 196,
  };

  function musicLevel(pct) {
    const p = Math.max(0, Math.min(100, pct)) / 100;
    return p * 0.9;
  }

  function sfxLevel(pct) {
    const p = Math.max(0, Math.min(100, pct)) / 100;
    return p * 0.85;
  }

  function applyGains() {
    if (!musicGain || !sfxGain) return;
    musicGain.gain.value = musicLevel(musicPct);
    sfxGain.gain.value = sfxLevel(sfxPct);
    if (musicEl) musicEl.volume = 1; // gain node owns loudness
  }

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.connect(master);
    applyGains();
  }

  function ensureMusic() {
    ensure();
    if (musicEl) return;
    // CC0: "Whispers in the Fog" — Ruhinre (OpenGameArt)
    musicEl = new Audio('sounds/dungeon.ogg');
    musicEl.loop = true;
    musicEl.preload = 'auto';
    const src = ctx.createMediaElementSource(musicEl);
    src.connect(musicGain);
  }

  function unlock() {
    if (unlocking) return unlocking;
    unlocking = (async () => {
      ensure();
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (_) { /* ignore */ }
      }
      started = true;
      if (musicPct > 0) startMusic();
    })().finally(() => { unlocking = null; });
    return unlocking;
  }

  function beep(freq, dur = 0.09, type = 'square', vol = 1) {
    if (sfxPct <= 0 || !started || !ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.5 * vol), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  async function move(dir) {
    await unlock();
    if (sfxPct <= 0) return;
    const f = MOVE[dir] || 300;
    beep(f, 0.09, 'square', 1);
    window.setTimeout(() => beep(f * 1.5, 0.06, 'triangle', 0.45), 35);
  }

  function startMusic() {
    if (musicPct <= 0 || !started) return;
    ensureMusic();
    applyGains();
    const play = musicEl.play();
    if (play && typeof play.catch === 'function') play.catch(() => {});
  }

  function stopMusic() {
    if (!musicEl) return;
    musicEl.pause();
    try { musicEl.currentTime = 0; } catch (_) { /* ignore */ }
  }

  function setMusicVolume(pct) {
    musicPct = Math.max(0, Math.min(100, Number(pct) || 0));
    ensure();
    applyGains();
    if (musicPct <= 0) stopMusic();
    else unlock().then(() => startMusic());
  }

  function setSfxVolume(pct) {
    sfxPct = Math.max(0, Math.min(100, Number(pct) || 0));
    ensure();
    applyGains();
  }

  return {
    unlock,
    move,
    setMusicVolume,
    setSfxVolume,
    getMusicVolume: () => musicPct,
    getSfxVolume: () => sfxPct,
  };
})();
