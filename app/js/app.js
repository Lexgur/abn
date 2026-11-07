(() => {
  const MIN = 1;
  const MAX = 1000;

  const DELTA = {
    up: -10,
    down: 10,
    left: -1,
    right: 1,
    'hundred-up': -100,
    'hundred-down': 100,
  };

  const COUNTER_KEY = {
    up: 'tens',
    down: 'tens',
    left: 'units',
    right: 'units',
    'hundred-up': 'hundreds',
    'hundred-down': 'hundreds',
  };

  function readPct(key, fallback) {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
  }

  // Defaults: music louder than before; migrate off old mute flags
  if (localStorage.getItem('abn-audio-v') !== '4') {
    localStorage.setItem('abn-music-vol', '70');
    localStorage.setItem('abn-sfx-vol', '55');
    localStorage.setItem('abn-audio-v', '4');
  }

  const state = {
    value: 1,
    units: 0,
    tens: 0,
    hundreds: 0,
    path: new Set([1]),
    pageStart: 1,
    lang: localStorage.getItem('abn-lang') || 'es',
    musicVol: readPct('abn-music-vol', 70),
    sfxVol: readPct('abn-sfx-vol', 55),
  };

  const els = {
    board: document.getElementById('board'),
    pageRange: document.getElementById('pageRange'),
    pageHome: document.getElementById('pageHome'),
    pagePrev: document.getElementById('pagePrev'),
    pageNext: document.getElementById('pageNext'),
    number: document.getElementById('number'),
    countUnits: document.getElementById('countUnits'),
    countTens: document.getElementById('countTens'),
    countHundreds: document.getElementById('countHundreds'),
    tokensUnits: document.getElementById('tokensUnits'),
    tokensTens: document.getElementById('tokensTens'),
    tokensHundreds: document.getElementById('tokensHundreds'),
    lang: document.getElementById('lang'),
    musicVol: document.getElementById('musicVol'),
    sfxVol: document.getElementById('sfxVol'),
    musicVolPct: document.getElementById('musicVolPct'),
    sfxVolPct: document.getElementById('sfxVolPct'),
    reset: document.getElementById('reset'),
  };

  const cells = new Map();
  let strings = {};

  function clamp(n) {
    return Math.min(MAX, Math.max(MIN, n));
  }

  function pageStartFor(n) {
    const v = clamp(n);
    return Math.floor((v - 1) / 100) * 100 + 1;
  }

  function pageEnd(start) {
    return Math.min(MAX, start + 99);
  }

  function fillTokens(el, count, maxShow = 16) {
    el.innerHTML = '';
    const shown = Math.min(count, maxShow);
    for (let i = 0; i < shown; i += 1) {
      const t = document.createElement('span');
      t.className = 'token';
      el.appendChild(t);
    }
  }

  function rebuildBoard(start) {
    state.pageStart = start;
    const end = pageEnd(start);
    els.pageRange.textContent = `${start}–${end}`;
    els.board.innerHTML = '';
    cells.clear();

    for (let n = start; n <= end; n += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell';
      btn.textContent = String(n);
      btn.dataset.n = String(n);
      btn.setAttribute('role', 'gridcell');
      btn.addEventListener('click', () => jumpTo(n));
      els.board.appendChild(btn);
      cells.set(n, btn);
    }

    // Keep a fixed 10x10 grid even on 901–1000 (100 cells). 901–1000 is exactly 100.
  }

  function ensurePage(n, force = false) {
    const start = pageStartFor(n);
    if (force || start !== state.pageStart || cells.size === 0) {
      rebuildBoard(start);
    }
  }

  function paintBoard(from) {
    for (const [n, el] of cells) {
      el.classList.toggle('path', state.path.has(n) && n !== state.value);
      el.classList.toggle('here', n === state.value);
      el.classList.toggle('from', from != null && n === from);
      el.classList.remove('walk');
    }
    const here = cells.get(state.value);
    if (here) {
      here.classList.add('walk');
      here.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function renderCounts() {
    els.countUnits.textContent = String(state.units);
    els.countTens.textContent = String(state.tens);
    els.countHundreds.textContent = String(state.hundreds);
    fillTokens(els.tokensUnits, state.units);
    fillTokens(els.tokensTens, state.tens);
    fillTokens(els.tokensHundreds, state.hundreds);
  }

  function render(from) {
    ensurePage(state.value);
    if (document.activeElement !== els.number) {
      els.number.value = String(state.value);
    }
    renderCounts();
    paintBoard(from);
    els.pagePrev.disabled = state.pageStart <= 1;
    els.pageNext.disabled = pageEnd(state.pageStart) >= MAX;
  }

  async function loadLang(code) {
    const res = await fetch(`i18n/${code}.json`);
    strings = await res.json();
    document.documentElement.lang = code;
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (strings[key] != null) node.textContent = strings[key];
    });
    document.querySelectorAll('[data-i18n-title]').forEach((node) => {
      const key = node.getAttribute('data-i18n-title');
      if (strings[key] != null) {
        node.title = strings[key];
        const parent = node.closest('[title]');
        if (parent) parent.title = strings[key];
      }
    });
    document.title = strings.title || 'ABN Tabla';
    syncVolumeUI();
  }

  function syncVolumeUI() {
    els.musicVol.value = String(state.musicVol);
    els.sfxVol.value = String(state.sfxVol);
    els.musicVolPct.textContent = `${state.musicVol}%`;
    els.sfxVolPct.textContent = `${state.sfxVol}%`;
  }

  function parseInput() {
    const raw = els.number.value.trim().replace(/[^\d]/g, '');
    if (raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  function commitInput() {
    const n = parseInput();
    if (n == null) {
      els.number.value = String(state.value);
      return;
    }
    jumpTo(clamp(n), false);
  }

  function jumpTo(n, play = true) {
    const from = cells.has(state.value) ? state.value : null;
    state.value = clamp(n);
    state.path.add(state.value);
    render(from);
    if (play) AudioBus.move('right');
  }

  function goPage(start, countAsHundred = false) {
    const oldStart = state.pageStart;
    const targetStart = Math.min(901, Math.max(1, start));
    // Keep place inside the hundred (e.g. 157 → 57 / 257)
    const offset = (state.value - 1) % 100;
    const next = clamp(targetStart + offset);
    const from = cells.has(state.value) ? state.value : null;
    state.value = next;
    state.path.add(state.value);
    if (countAsHundred) state.hundreds += 1;
    ensurePage(state.value, true);
    render(from);
    if (countAsHundred) {
      AudioBus.move(targetStart > oldStart ? 'hundred-down' : 'hundred-up');
    }
  }

  async function move(dir) {
    const from = state.value;
    const delta = DELTA[dir];
    if (delta == null) return;

    const next = state.value + delta;
    if (next < MIN || next > MAX) {
      // Soft bump at edges
      await AudioBus.move(dir);
      paintBoard(from);
      return;
    }

    state.value = next;
    state[COUNTER_KEY[dir]] += 1;
    state.path.add(state.value);

    const btn = document.querySelector(`.arrow[data-dir="${dir}"]`);
    if (btn) {
      btn.classList.add('flash');
      setTimeout(() => btn.classList.remove('flash'), 120);
    }

    render(cells.has(from) ? from : null);
    await AudioBus.move(dir);
  }

  function resetCounters() {
    state.units = 0;
    state.tens = 0;
    state.hundreds = 0;
    state.path = new Set([state.value]);
    render();
  }

  document.querySelectorAll('.arrow[data-dir]').forEach((btn) => {
    btn.addEventListener('click', () => move(btn.dataset.dir));
  });

  window.addEventListener('keydown', (e) => {
    if (e.target === els.number && (e.key === 'Enter' || e.key === 'Escape')) {
      els.number.blur();
      commitInput();
      return;
    }
    if (e.target === els.number) return;

    const map = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      PageUp: 'hundred-up',
      PageDown: 'hundred-down',
    };
    const dir = map[e.key];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  });

  els.number.addEventListener('change', commitInput);
  els.number.addEventListener('blur', commitInput);
  els.reset.addEventListener('click', resetCounters);

  els.pageHome.addEventListener('click', () => {
    state.value = clamp(((state.value - 1) % 100) + 1);
    state.path.add(state.value);
    ensurePage(1, true);
    render();
    AudioBus.move('hundred-up');
  });

  els.pagePrev.addEventListener('click', () => {
    goPage(state.pageStart - 100, true);
  });

  els.pageNext.addEventListener('click', () => {
    goPage(state.pageStart + 100, true);
  });

  els.lang.value = state.lang;
  els.lang.addEventListener('change', async () => {
    state.lang = els.lang.value;
    localStorage.setItem('abn-lang', state.lang);
    await loadLang(state.lang);
  });

  els.musicVol.addEventListener('input', async () => {
    state.musicVol = Number(els.musicVol.value);
    localStorage.setItem('abn-music-vol', String(state.musicVol));
    els.musicVolPct.textContent = `${state.musicVol}%`;
    AudioBus.setMusicVolume(state.musicVol);
    await AudioBus.unlock();
  });

  els.sfxVol.addEventListener('input', async () => {
    state.sfxVol = Number(els.sfxVol.value);
    localStorage.setItem('abn-sfx-vol', String(state.sfxVol));
    els.sfxVolPct.textContent = `${state.sfxVol}%`;
    AudioBus.setSfxVolume(state.sfxVol);
    await AudioBus.unlock();
  });

  const kick = () => AudioBus.unlock();
  window.addEventListener('pointerdown', kick, { once: true });
  window.addEventListener('keydown', kick, { once: true });

  AudioBus.setMusicVolume(state.musicVol);
  AudioBus.setSfxVolume(state.sfxVol);
  syncVolumeUI();
  ensurePage(state.value, true);
  loadLang(state.lang).then(() => render());
})();
