import { attachPinPad } from './pinpad.js';
import { api } from './api.js';
import { ITEMS } from './config.js';
import { TIERS, tierFor, latestBest, gradeKey } from './tiers.js';
import { loadTable, el, badge, show, fmt } from './ui.js';
import { bestOfDay } from './tiers.js';
import { makeStore } from './offline.js';
import { gradeColor, gradeInk } from './grades.js';
import { LOWER, unitOf, keyLabel, dotEnabled, pressKey, parseEntry, entryText } from './entry.js';
import { savePrep, prepLabel } from './autoprep.js';
import { renderGuide } from './guide.js';

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

const store = makeStore(window.localStorage);
async function load() {
  $('dash-error').textContent = '';
  const d = await api.teacherList(pin);
  roster = d.roster; records = d.records;
  savePrep(store, window.localStorage, roster, records); prepUI();   // 받아 올 때마다 이 태블릿에 자동 저장 (오프라인용)
}
function renderDash() {
  const list = filtered(), table = $('table'); table.replaceChildren();
  table.append(el('tr', {}, el('th', {}, '이름'), el('th', {}, '학년'), ...ITEMS.map((i) => el('th', {}, i.label))));
  for (const s of list) {
    const tr = el('tr', {}, el('td', { class: 'name' }, el('button', { class: 'ghost gname', style: `--gc:${gradeColor(s.grade)};--gi:${gradeInk(s.grade)}`, onclick: () => openStudent(s) }, s.name)), el('td', {}, `${s.grade}`));
    for (const it of ITEMS) {
      const { rec, t } = curTier(s, it.key);
      const open = () => openCell(s, it);
      tr.append(el('td', { class: 'cell', tabindex: '0', role: 'button', 'aria-label': `${s.name} ${it.label} 기록 입력`, onclick: open, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } },
        !rec ? el('span', { class: 'plus' }, '＋') : !s.sex ? '성별 필요' : el('div', {}, badge(t.index, true), el('div', { class: 'muted' }, `${fmt(it.key, rec.value)}${it.unit}`))));
    }
    table.append(tr);
  }
  const key = $('f-item').value, counts = new Array(9).fill(0);
  for (const s of list) { const { t } = curTier(s, key); if (t) counts[t.index]++; }
  const max = Math.max(1, ...counts), bars = $('bars'), legend = $('legend'); bars.replaceChildren(); legend.replaceChildren();
  counts.forEach((c, i) => { bars.append(el('div', { style: `height:${(c / max) * 100}%`, title: `${TIERS[i]} ${c}명` }, el('span', {}, c || ''))); legend.append(el('div', {}, badge(i, true), el('span', {}, TIERS[i]))); });
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
  const W = 220, H = 90, P = 10, lower = LOWER.has(it.key);
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
    t.append(el('tr', {}, el('td', {}, dateIn), el('td', {}, it.label), el('td', {}, valIn, ` ${it.mmss ? '초' : it.unit}`), el('td', {}, r.by), el('td', {}, tier ? tier.tier : '–'),
      el('td', {}, el('button', { onclick: () => run(() => api.teacherUpdate(pin, r.recordId, { value: valIn.value, date: dateIn.value })) }, '수정'), ' ', del)));
  }
  if (!mine.length) t.append(el('tr', {}, el('td', { colspan: 6, class: 'muted' }, '아직 기록이 없어요.')));
}
async function run(fn) {
  $('s-error').textContent = '';
  try { await fn(); await load(); renderStudent(); renderDash(); }
  catch (e) { $('s-error').textContent = e.message; }
}

/* ── 표의 칸을 눌러 바로 기록 입력·고치기 (숫자 키패드) ── */
let cellCur = null;   // { s, it, rec }
function cellExisting() {
  const { s, it } = cellCur, d = $('cell-date').value;
  const same = records.filter((r) => r.id === s.id && r.item === it.key && r.date === d);
  return same.length ? same[same.length - 1] : null;
}
function cellSync() {
  cellCur.rec = cellExisting(); const rec = cellCur.rec;
  $('cell-val').value = rec ? entryText(cellCur.it, rec.value) : '';
  $('cell-note').textContent = rec ? '이 날짜에 이미 기록이 있어요. 저장하면 고쳐져요.' : '';
  $('cell-del').hidden = !rec; $('cell-del').dataset.armed = ''; $('cell-del').textContent = '이 기록 지우기';
  $('cell-save').textContent = rec ? '고치기' : '저장하기'; $('cell-error').textContent = '';
}
function openCell(s, it) {
  cellCur = { s, it, rec: null };
  $('cell-title').textContent = `${s.name} · ${it.label}`; $('cell-unit').textContent = unitOf(it);
  $('cell-date').value = today(); $('cell-minus').hidden = it.min >= 0;
  const dot = $('cell-pad').querySelector('[data-key="."]'); dot.disabled = !dotEnabled(it); dot.textContent = keyLabel(it, '.');
  cellSync(); $('cell').hidden = false; $('cell-save').focus();
}
function closeCell() { $('cell').hidden = true; cellCur = null; }
function cellPress(k) { $('cell-error').textContent = ''; $('cell-val').value = pressKey(cellCur.it, $('cell-val').value, k); }
for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']) $('cell-pad').append(el('button', { type: 'button', 'data-key': k, class: k === '⌫' ? 'del' : '', 'aria-label': k === '⌫' ? '지우기' : k === '.' ? '소수점' : k }, k === '⌫' ? '지우기' : k));
$('cell-pad').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-key]'); if (b && cellCur && !b.disabled) cellPress(b.dataset.key); });
$('cell-minus').addEventListener('click', () => { const v = $('cell-val'); v.value = v.value.startsWith('-') ? v.value.slice(1) : '-' + v.value; });
$('cell-date').addEventListener('change', () => { if (cellCur) cellSync(); });
$('cell-close').addEventListener('click', closeCell);
$('cell').addEventListener('click', (ev) => { if (ev.target === $('cell')) closeCell(); });
$('cell-save').addEventListener('click', async () => {
  const { s, it } = cellCur, shown = $('cell-val').value.trim(), date = $('cell-date').value;
  if (!date) { $('cell-error').textContent = '날짜를 골라 주세요.'; return; }
  const pe = parseEntry(it, shown);
  if (pe.error) { $('cell-error').textContent = pe.error; return; }
  const raw = pe.send;
  $('cell-save').disabled = true;
  try {
    if (cellCur.rec) await api.teacherUpdate(pin, cellCur.rec.recordId, { value: raw, date });
    else await api.teacherAdd(pin, { id: s.id, date, item: it.key, value: raw });
    await load(); renderDash(); $('dash-note').textContent = `${s.name} · ${it.label} ${shown}${it.unit}을(를) ${cellCur.rec ? '고쳤어요' : '저장했어요'}.`; closeCell();
  } catch (e) { $('cell-error').textContent = e.message; }
  finally { $('cell-save').disabled = false; }
});
$('cell-del').addEventListener('click', async () => {
  const b = $('cell-del');
  if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = '정말 지울까요? 한 번 더 누르세요'; return; }
  try { await api.teacherDelete(pin, cellCur.rec.recordId); await load(); renderDash(); $('dash-note').textContent = '기록을 지웠어요.'; closeCell(); }
  catch (e) { $('cell-error').textContent = e.message; }
});

$('login').addEventListener('submit', async (ev) => {
  ev.preventDefault(); pin = $('pin').value; $('login-error').textContent = '';
  try { await load(); $('pin').value = ''; renderDash(); prepUI(); show(root, 'dash'); }
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
function prepUI() { const e = $('prep-at'); if (e) e.textContent = prepLabel(window.localStorage); }
function bannerCheck() {
  const m = new Date().getMonth() + 1, k = 'backup-' + new Date().getFullYear() + '-' + (m >= 12 || m <= 1 ? 'w' : m === 7 ? 's' : '');
  let seen = false; try { seen = !!localStorage.getItem(k); } catch (e) {}
  $('backup-banner').hidden = !(k.endsWith('w') || k.endsWith('s')) || seen;
  $('banner-close').onclick = () => { try { localStorage.setItem(k, '1'); } catch (e) {} $('backup-banner').hidden = true; };
}
bannerCheck();
$('s-back').addEventListener('click', () => { renderDash(); show(root, 'dash'); });
$('open-guide').addEventListener('click', () => { renderGuide($('guide-box')); show(root, 'guide'); window.scrollTo(0, 0); });
$('guide-back').addEventListener('click', () => show(root, 'dash'));

for (const sel of [$('f-item'), $('a-item')]) for (const it of ITEMS) sel.append(el('option', { value: it.key }, sel.id === 'a-item' && it.mmss ? `${it.label} (초 단위로 입력)` : it.label));
$('ver').textContent = 'v30';
await loadTable();
attachPinPad($('pin'));   // 비밀번호는 숫자 키패드 창으로 입력
