// Sunset Ledger — GTA VI trophy guide & tracker. Loads its data files, keeps progress
// in localStorage, and renders the tracker, roadmap, missables and sources tabs.
// Everything runs offline: the only fetches are relative files under app/.
const LS_KEY = 'sunset-ledger-v5';
const DEMO_EARNED = [2, 3, 4, 5, 6, 8, 15, 17, 20, 28, 35, 42, 55];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const isDemo = params.get('demo') === '1';
const openId = Number(params.get('open') || 0);

let trophies = [];
let sources = [];
let sourcesNote = '';
let roadmap = null;
let earned = new Set();
let openRow = 0;

function loadSaved() {
  if (isDemo) { earned = new Set(DEMO_EARNED); return; }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.earned)) earned = new Set(data.earned.filter((n) => Number.isInteger(n)));
  } catch { earned = new Set(); }
}

function save() {
  if (isDemo) return;
  try { localStorage.setItem(LS_KEY, JSON.stringify({ earned: [...earned].sort((a, b) => a - b), savedAt: new Date().toISOString() })); } catch { /* storage unavailable: progress stays for this session */ }
}

const gradeName = (g) => ({ platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' }[g] || g);
const kindName = (k) => ({ story: 'Story', side: 'Character & strangers', collectible: 'Collectibles', activity: 'Activities', misc: 'Everything else', platinum: 'Platinum' }[k] || k);
const gradeLetter = (g) => ({ platinum: 'P', gold: 'G', silver: 'S', bronze: 'B' }[g] || '?');

function sourceLabel(id) {
  const s = sources.find((x) => x.id === String(id));
  return s ? s.name : 'Source ' + id;
}

function renderProgress() {
  const n = earned.size;
  $('#earnedCount').textContent = String(n);
  $('#pct').textContent = Math.round((n / trophies.length) * 100) + '%';
  $('#progressBar').style.width = ((n / trophies.length) * 100).toFixed(1) + '%';
  const chips = ['platinum', 'gold', 'silver', 'bronze'].map((g) => {
    const total = trophies.filter((t) => t.grade === g).length;
    const got = trophies.filter((t) => t.grade === g && earned.has(t.id)).length;
    return '<span class="chip"><span class="dot ' + g + '"></span>' + gradeName(g) + ' <b>' + got + '/' + total + '</b></span>';
  }).join('');
  $('#gradeChips').innerHTML = chips;
}

function renderAudit() {
  const steps = trophies.reduce((a, t) => a + (t.steps ? t.steps.length : 0), 0);
  const miss = trophies.filter((t) => t.missable).length;
  const unc = trophies.filter((t) => t.unconfirmed).length;
  const cited = trophies.filter((t) => t.sources && t.sources.length).length;
  $('#auditStrip').innerHTML =
    '<span><b>' + trophies.length + '</b> trophies · 1P 2G 6S 46B</span>' +
    '<span><b>' + trophies.length + '/' + trophies.length + '</b> guides</span>' +
    '<span><b>' + cited + '/' + trophies.length + '</b> cited</span>' +
    '<span><b>' + steps + '</b> cited steps</span>' +
    '<span class="warn"><b>' + miss + '</b> missable</span>' +
    '<span><b>' + unc + '</b> unconfirmed methods</span>' +
    '<span><b>0</b> online trophies</span>';
}

function trophyRow(t) {
  const spoiler = $('#spoilerToggle').checked;
  const hidden = spoiler && t.kind === 'story' && !earned.has(t.id);
  const li = document.createElement('li');
  li.className = 'row' + (earned.has(t.id) ? ' earned' : '') + (openRow === t.id ? ' open' : '');
  li.dataset.id = String(t.id);
  const tags = [];
  tags.push('<span class="tag">' + kindName(t.kind) + '</span>');
  if (t.missable) tags.push('<span class="tag miss">⚠ Missable</span>');
  if (t.unconfirmed) tags.push('<span class="tag unc">? Unconfirmed</span>');
  if (t.count != null) tags.push('<span class="tag count">' + t.count + (t.countLabel ? ' ' + t.countLabel : '') + '</span>');
  const name = hidden ? '<span class="masked">Hidden story trophy — earn it to reveal</span>' : escapeHtml(t.name);
  const desc = hidden ? '<span class="masked">Spoilers hidden until earned.</span>' : escapeHtml(t.description);
  const srcLinks = (t.sources || []).map((id) => {
    const s = sources.find((x) => x.id === String(id));
    return s && s.url ? '<a href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener">[' + escapeHtml(id) + '] ' + escapeHtml(s.name) + '</a>' : '[' + escapeHtml(id) + '] ' + escapeHtml(sourceLabel(id));
  }).join(' · ');
  li.innerHTML =
    '<div class="rowhead" role="button" tabindex="0" aria-expanded="' + (openRow === t.id) + '">' +
    '<input type="checkbox" ' + (earned.has(t.id) ? 'checked' : '') + ' aria-label="Earned: ' + escapeAttr(t.name) + '">' +
    '<span class="grade ' + t.grade + '" title="' + gradeName(t.grade) + '">' + gradeLetter(t.grade) + '</span>' +
    '<span class="main"><span class="name">' + name + '</span><span class="desc"><br>' + desc + '</span>' +
    '<span class="tags">' + tags.join('') + '</span></span>' +
    '<span class="caret">' + (openRow === t.id ? '▾' : '▸') + ' Guide</span></div>' +
    '<div class="guide">' +
    '<p>' + escapeHtml(t.guide) + '</p>' +
    (t.steps && t.steps.length ? '<ol>' + t.steps.map((s) => '<li>' + escapeHtml(s) + '</li>').join('') + '</ol>' : '') +
    (t.unconfirmed ? '<p class="unc-note">Unconfirmed: ' + escapeHtml(t.unconfirmed) + ' This guide flags it honestly instead of inventing a method.</p>' : '') +
    '<p class="srcs"><b>Sources:</b> ' + srcLinks + '</p></div>';
  const box = li.querySelector('input[type="checkbox"]');
  box.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (box.checked) earned.add(t.id); else earned.delete(t.id);
    save(); renderProgress(); renderList();
  });
  const head = li.querySelector('.rowhead');
  const toggle = () => { openRow = openRow === t.id ? 0 : t.id; renderList(); };
  head.addEventListener('click', (ev) => { if (ev.target !== box) toggle(); });
  head.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); } });
  return li;
}

function renderList() {
  const q = ($('#search').value || '').trim().toLowerCase();
  const kind = $('#kindFilter').value;
  const grade = $('#gradeFilter').value;
  const hideEarned = $('#hideEarned').checked;
  const list = $('#trophyList');
  list.innerHTML = '';
  let shown = 0;
  for (const t of trophies) {
    if (kind !== 'all' && t.kind !== kind) continue;
    if (grade !== 'all' && t.grade !== grade) continue;
    if (hideEarned && earned.has(t.id)) continue;
    if (q && !(t.name + ' ' + t.description + ' ' + t.guide + ' ' + (t.steps || []).join(' ')).toLowerCase().includes(q)) continue;
    list.appendChild(trophyRow(t));
    shown++;
  }
  $('#emptyNote').hidden = shown !== 0;
}

function renderRoadmap() {
  const el = $('#roadmapView');
  const head = '<div class="facts"><span>Difficulty <b>' + escapeHtml(roadmap.difficulty) + '</b></span>' +
    '<span>Time <b>' + escapeHtml(roadmap.estimate) + '</b></span>' +
    '<span>Playthroughs <b>' + roadmap.playthroughs + '</b></span>' +
    '<span>Online trophies <b>' + roadmap.online + '</b></span></div>' +
    '<div class="callout"><h2>One trophy can be missed</h2><p>' + escapeHtml(roadmap.missableNote) + '</p></div>';
  el.innerHTML = head + roadmap.stages.map((st) => {
    const chips = st.trophies.map((id) => {
      const t = trophies.find((x) => x.id === id);
      if (!t) return '';
      return '<span class="chip' + (earned.has(id) ? ' done' : '') + '"><span class="dot ' + t.grade + '"></span><b>' + escapeHtml(t.name) + '</b> · ' + gradeName(t.grade) + '</span>';
    }).join('');
    return '<div class="stage"><h2>' + escapeHtml(st.name) + '<span class="hours">' + escapeHtml(st.hours) + '</span></h2><p>' + escapeHtml(st.detail) + '</p><div class="chips">' + chips + '</div></div>';
  }).join('');
}

function renderMissables() {
  const miss = trophies.filter((t) => t.missable);
  const el = $('#missableView');
  el.innerHTML = '<div class="facts"><span>Potentially missable <b>' + miss.length + ' of 55</b></span><span>Everything else <b>unmissable</b></span></div>' +
    miss.map((t) => {
      const srcLinks = (t.sources || []).map((id) => {
        const s = sources.find((x) => x.id === String(id));
        return s && s.url ? '<a href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener">[' + escapeHtml(id) + '] ' + escapeHtml(s.name) + '</a>' : '[' + escapeHtml(id) + '] ' + escapeHtml(sourceLabel(id));
      }).join(' · ');
      return '<div class="callout"><h2>⚠ ' + escapeHtml(t.name) + ' — ' + escapeHtml(t.description) + '</h2><p>' + escapeHtml(t.guide) + '</p>' +
        (t.steps && t.steps.length ? '<ol>' + t.steps.map((s) => '<li>' + escapeHtml(s) + '</li>').join('') + '</ol>' : '') +
        '<p class="srcs"><b>Sources:</b> ' + srcLinks + '</p></div>';
    }).join('') +
    '<div class="stage"><h2>Everything else is safe</h2><p>PowerPyx confirms there is only 1 potentially missable trophy. Quest givers sometimes go away for a while during the story (Kenton is the famous one), but every trophy-related character comes back later, and all trophy content stays available in free-roam after the ending. Optional missions that disappear do not matter for trophies. The only insurance worth having: with 15 manual save slots and no mission replay, keep one save at the start and one at the end of each chapter (10 saves), and rotate the other 5 during cleanup. Cheats disable trophies and saving, so keep them off the platinum save.</p></div>';
}

function renderSources() {
  const el = $('#sourcesView');
  el.innerHTML = '<p class="note">Every guide names its sources beside the trophy. Nothing is copied from these pages: each guide is written in our own words, and the sources are cited for the facts they carry.</p>' +
    sources.map((s, i) => {
      return '<div class="srcrow"><h3><span class="n">[' + s.id + ']</span>' + escapeHtml(s.name) + '</h3><p>' + escapeHtml(s.covers) + '</p>' +
        (s.url ? '<a href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener">' + escapeHtml(s.url) + '</a>' : '') + '</div>';
    }).join('') +
    '<p class="note" style="margin-top:14px"><b>Honesty note.</b> ' + escapeHtml(sourcesNote) + '</p>' +
    '<p class="note"><b>Spoiler setting.</b> Flip “Hide story spoilers” in the tracker and story trophies stay hidden — name and description masked — until you earn them. Earned trophies always show.</p>';
}

function switchTab(name) {
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + name));
  if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

async function init() {
  const [tRes, sRes, rRes] = await Promise.all([
    fetch('data/trophies.json'), fetch('data/sources.json'), fetch('data/roadmap.json'),
  ]);
  const tData = await tRes.json();
  const sData = await sRes.json();
  roadmap = await rRes.json();
  trophies = tData.trophies;
  sources = sData.sources;
  sourcesNote = sData.note || '';
  loadSaved();
  if (openId && trophies.some((t) => t.id === openId)) {
    openRow = openId;
  }
  $('#demoNote').hidden = !isDemo;
  renderProgress();
  renderAudit();
  renderList();
  renderRoadmap();
  renderMissables();
  renderSources();
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('#search').addEventListener('input', renderList);
  $('#kindFilter').addEventListener('change', renderList);
  $('#gradeFilter').addEventListener('change', renderList);
  $('#hideEarned').addEventListener('change', renderList);
  $('#spoilerToggle').addEventListener('change', renderList);
  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ game: 'Grand Theft Auto VI', earned: [...earned].sort((a, b) => a - b), exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sunset-ledger-progress.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (Array.isArray(data.earned)) {
        earned = new Set(data.earned.filter((n) => Number.isInteger(n) && trophies.some((t) => t.id === n)));
        save(); renderProgress(); renderList(); renderRoadmap();
      }
    } catch { alert('That file is not a Sunset Ledger progress export.'); }
    ev.target.value = '';
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Clear all earned trophies?')) return;
    earned = new Set();
    save(); renderProgress(); renderList(); renderRoadmap();
  });
  const hash = (location.hash || '#tracker').slice(1);
  if (['tracker', 'roadmap', 'missables', 'sources'].includes(hash)) switchTab(hash);
  if (openRow) {
    const row = $('.row[data-id="' + openRow + '"]');
    if (row) row.scrollIntoView({ block: 'nearest' });
  }
}

init().catch((err) => {
  document.getElementById('trophyList').innerHTML = '<li class="row"><p style="padding:16px 4px">Could not load the trophy data (' + escapeHtml(err.message) + '). Serve app/ over HTTP and try again.</p></li>';
});
