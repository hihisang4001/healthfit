import { api } from './api.js';
import { ITEMS } from './config.js';
import { TIERS, tierFor, latestBest, gradeKey } from './tiers.js';
import { loadTable, el, badge, show, fmt } from './ui.js';
import { bestOfDay } from './tiers.js';
import { makeStore } from './offline.js';

const root = document.getElementById('app');
const $ = (id) => document.getElementById(id);
let pin = '', roster = [], records = [], current = null;
const itemOf = (k) => ITEMS.find((i) => i.key === k);
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

function curTier(s, item) {
  const rec = latestBest(records.filter((r) => r.id === s.id), item);
  if (!rec) return { rec: null };
  return { rec, t: tierFor(item, gradeKey(s.grade, s.sex), rec.value) };
}
function filtered() {
  const g = $('f-grade').value, x = $('f-sex').value;
  return roster.filter((s) => (!g || String(s.grade) === g) && (!x || s.sex === x));
}

async function load() {
  $('dash-error').textContent = '';
  const d = await api.teacherList(pin);
  roster = d.roster; records = d.records;
}
function renderDash() {
  const list = filtered(), table = $('table'); table.replaceChildren();
  table.append(el('tr', {}, el('th', {}, '이름'), el('th', {}, '학년'), ...ITEMS.map((i) => el('th', {}, i.label))));
  for (const s of list) {
    const tr = el('tr', {}, el('td', { class: 'name' }, el('button', { class: 'ghost', onclick: () => openStudent(s) }, s.name)), el('td', {}, `${s.grade}`));
    for (const it of ITEMS) {
      const { rec, t } = curTier(s, it.key);
      tr.append(el('td', {}, !rec ? '–' : !s.sex ? '성별 필요' : el('div', {}, badge(t.index, true), el('div', { class: 'muted' }, `${fmt(it.key, rec.value)}${it.unit}`))));
    }
    table.append(tr);
  }
  const key = $('f-item').value, counts = new Array(9).fill(0);
  for (const s of list) { const { t } = curTier(s, key); if (t) counts[t.index]++; }
  const max = Math.max(1, ...counts), bars = $('bars'), legend = $('legend'); bars.replaceChildren(); legend.replaceChildren();
  counts.forEach((c, i) => { bars.append(el('div', { style: `height:${(c / max) * 100}%`, title: `${TIERS[i]} ${c}명` }, el('span', {}, c || ''))); legend.append(el('div', {}, TIERS[i])); });
}
function openStudent(s) {
  current = s; $('s-error').textContent = '';
  $('s-title').textContent = `${s.name} (${s.grade}학년${s.sex ? ' ' + s.sex : ', 성별 필요'})`;
  $('a-date').value = today(); $('a-value').value = '';
  renderStudent(); show(root, 'student');
}
const SVGNS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...kids) { const n = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); n.append(...kids); return n; }
function chart(it, pts) {
  const W = 220, H = 90, P = 10, lower = it.key === 'run50';
  const vals = pts.map((p) => p.value), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i) => (pts.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (pts.length - 1));
  const y = (v) => { const f = (v - lo) / span; return P + (lower ? f : 1 - f) * (H - 2 * P); };
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'spark', role: 'img', 'aria-label': `${it.label} 변화` });
  if (pts.length > 1) g.append(svg('path', { d: line, fill: 'none', stroke: 'var(--turf)', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
  pts.forEach((p, i) => g.append(svg('circle', { cx: x(i), cy: y(p.value), r: 4.5, fill: 'var(--turf)' }, svg('title', {}, `${p.date} ${fmt(it.key, p.value)}${it.unit}`))));
  return g;
}
function renderCharts() {
  const box = $('charts'); box.replaceChildren();
  const mine = records.filter((r) => r.id === current.id), key = gradeKey(current.grade, current.sex);
  for (const it of ITEMS) {
    const pts = bestOfDay(mine.filter((r) => r.item === it.key)).sort((a, b) => a.date.localeCompare(b.date));
    const last = pts[pts.length - 1], tier = last && key ? tierFor(it.key, key, last.value) : null;
    box.append(el('div', { class: 'card chart' },
      el('div', { class: 'row' }, el('b', { class: 'grow' }, it.label), tier ? badge(tier.index, true) : ''),
      pts.length ? chart(it, pts) : el('p', { class: 'muted' }, '기록 없음'),
      el('div', { class: 'muted' }, last ? `${pts.length}회 · 최근 ${fmt(it.key, last.value)}${it.unit} (${last.date.slice(5)})` : '')));
  }
}
function renderStudent() {
  renderCharts();
  const t = $('s-table'); t.replaceChildren();
  t.append(el('tr', {}, ...['날짜', '항목', '기록', '입력자', '등급', ''].map((h) => el('th', {}, h))));
  const mine = records.filter((r) => r.id === current.id).sort((a, b) => b.date.localeCompare(a.date));
  for (const r of mine) {
    const it = itemOf(r.item), tier = tierFor(r.item, gradeKey(r.grade, current.sex), r.value);
    const dateIn = el('input', { type: 'date', value: r.date, 'aria-label': '날짜' }), valIn = el('input', { value: String(r.value), inputmode: 'decimal', 'aria-label': '기록' });
    const del = el('button', { class: 'danger' }, '삭제');
    del.addEventListener('click', async () => {
      if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '정말 삭제'; return; }
      await run(() => api.teacherDelete(pin, r.recordId));
    });
    t.append(el('tr', {}, el('td', {}, dateIn), el('td', {}, it.label), el('td', {}, valIn, ` ${it.unit}`), el('td', {}, r.by), el('td', {}, tier ? tier.tier : '–'),
      el('td', {}, el('button', { onclick: () => run(() => api.teacherUpdate(pin, r.recordId, { value: valIn.value, date: dateIn.value })) }, '수정'), ' ', del)));
  }
  if (!mine.length) t.append(el('tr', {}, el('td', { colspan: 6, class: 'muted' }, '아직 기록이 없어요.')));
}
async function run(fn) {
  $('s-error').textContent = '';
  try { await fn(); await load(); renderStudent(); renderDash(); }
  catch (e) { $('s-error').textContent = e.message; }
}

$('login').addEventListener('submit', async (ev) => {
  ev.preventDefault(); pin = $('pin').value; $('login-error').textContent = '';
  try { await load(); $('pin').value = ''; renderDash(); show(root, 'dash'); }
  catch (e) { pin = ''; $('login-error').textContent = e.message; }
});
$('add').addEventListener('submit', (ev) => { ev.preventDefault(); run(() => api.teacherAdd(pin, { id: current.id, date: $('a-date').value, item: $('a-item').value, value: $('a-value').value })).then(() => { $('a-value').value = ''; }); });
['f-grade', 'f-sex', 'f-item'].forEach((id) => $(id).addEventListener('change', renderDash));
$('reload').addEventListener('click', async () => { try { await load(); renderDash(); } catch (e) { $('dash-error').textContent = e.message; } });
$('logout').addEventListener('click', () => { pin = ''; roster = []; records = []; show(root, 'login'); });
$('promote').addEventListener('click', async () => {
  const b = $('promote');
  if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = '정말 올리기 (되돌릴 수 없어요)'; setTimeout(() => { b.dataset.armed = ''; b.textContent = '학년 올리기'; }, 6000); return; }
  b.dataset.armed = ''; b.textContent = '학년 올리기';
  try { const r = await api.teacherPromote(pin); await load(); renderDash(); $('dash-error').textContent = ''; $('dash-note').textContent = `진급 ${r.promoted}명, 졸업 ${r.graduated}명 처리했어요.`; }
  catch (e) { $('dash-error').textContent = e.message; }
});
$('offline-prep').addEventListener('click', () => {
  // 학생 명단과 기록을 이 태블릿에만 저장해, 인터넷이 없어도 학생이 QR로 입장할 수 있게 한다
  try {
    const map = {};
    for (const s of roster) map[s.id] = { name: s.name, grade: s.grade, sex: s.sex, records: records.filter((r) => r.id === s.id) };
    const ok = makeStore(window.localStorage).cachePutMany(map);
    $('dash-error').textContent = ok ? '' : '저장 공간이 부족해요.';
    $('dash-note').textContent = ok ? `학생 ${roster.length}명을 이 태블릿에 저장했어요. 이제 인터넷이 끊겨도 기록할 수 있어요.` : '';
  } catch (e) { $('dash-error').textContent = '이 브라우저에서는 저장할 수 없어요.'; }
});
function bannerCheck() {
  const m = new Date().getMonth() + 1, k = 'backup-' + new Date().getFullYear() + '-' + (m >= 12 || m <= 1 ? 'w' : m === 7 ? 's' : '');
  let seen = false; try { seen = !!localStorage.getItem(k); } catch (e) {}
  $('backup-banner').hidden = !(k.endsWith('w') || k.endsWith('s')) || seen;
  $('banner-close').onclick = () => { try { localStorage.setItem(k, '1'); } catch (e) {} $('backup-banner').hidden = true; };
}
bannerCheck();
$('s-back').addEventListener('click', () => { renderDash(); show(root, 'dash'); });

for (const sel of [$('f-item'), $('a-item')]) for (const it of ITEMS) sel.append(el('option', { value: it.key }, it.label));
$('ver').textContent = 'v16';
await loadTable();
