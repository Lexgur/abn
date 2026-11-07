/** Soft 8-bit SFX + looping music. Volumes are 0–100 independently. */
const AudioBus = (() => {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
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

  // Map UI % → audible gain (music needs more headroom; was too quiet before)
  function musicLevel(pct) {
    const p = Math.max(0, Math.min(100, pct)) / 100;
    return p * p * 0.95; // curve keeps low % gentle, high % clearly audible
  }

  function sfxLevel(pct) {
    const p = Math.max(0, Math.min(100, pct)) / 100;
    return p * 0.85;
  }

  function applyGains() {
    if (!musicGain || !sfxGain) return;
    musicGain.gain.value = musicLevel(musicPct);
    sfxGain.gain.value = sfxLevel(sfxPct);
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

  function unlock() {
    if (unlocking) return unlocking;
    unlocking = (async () => {
      ensure();
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (_) { /* ignore */ }
      }
      started = true;
      if (musicPct > 0 && !musicTimer) startMusic();
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

  const PHRASE = [
    [262, 0.22], [294, 0.22], [330, 0.22], [392, 0.34],
    [330, 0.22], [294, 0.22], [262, 0.42],
    [196, 0.22], [220, 0.22], [262, 0.42],
  ];

  function playPhrase() {
    if (musicPct <= 0 || !started || !ctx) {
      musicTimer = null;
      return;
    }
    let t = ctx.currentTime + 0.02;
    for (const [freq, dur] of PHRASE) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.85, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(musicGain);
      osc.start(t);
      osc.stop(t + dur + 0.03);
      t += dur;
    }
    const totalMs = PHRASE.reduce((s, [, d]) => s + d, 0) * 1000 + 700;
    musicTimer = window.setTimeout(playPhrase, totalMs);
  }

  function startMusic() {
    stopMusic();
    if (musicPct <= 0 || !started) return;
    playPhrase();
  }

  function stopMusic() {
    if (musicTimer) window.clearTimeout(musicTimer);
    musicTimer = null;
  }

  function setMusicVolume(pct) {
    const prev = musicPct;
    musicPct = Math.max(0, Math.min(100, Number(pct) || 0));
    ensure();
    applyGains();
    if (musicPct <= 0) stopMusic();
    else if (prev <= 0 || !musicTimer) unlock().then(() => startMusic());
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
