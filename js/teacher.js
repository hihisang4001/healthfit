import { attachPinPad } from './pinpad.js';
import { api } from './api.js';
import { ITEMS } from './config.js';
import { TIERS, tierFor, latestBest, gradeKey } from './tiers.js';
import { loadTable, el, badge, show, fmt } from './ui.js';
import { bestOfDay } from './tiers.js';
import { makeStore } from './offline.js';
import { gradeColor, gradeInk } from './grades.js';
import { LOWER, unitOf, keyLabel, dotEnabled, pressKey, parseEntry, entryText, TWO_HAND, parseHands, splitLR } from './entry.js';
import { savePrep, prepLabel } from './autoprep.js';
import { renderGuide } from './guide.js';

const root = document.getElementById('app');
const $ = (id) => document.getElementById(id);
let pin = '', roster = [], records = [], current = null, undoInfo = null;
const itemOf = (k) => ITEMS.find((i) => i.key === k);
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

function curTier(s, item) {
  const rec = latestBest(records.filter((r) => r.id === s.id), item);
  if (!rec) return { rec: null };
  return { rec, t: tierFor(item, gradeKey(s.grade, s.sex), rec.value) };
}
function filtered() {
  const g = $('f-grade').value;
  return roster.filter((s) => !g || String(s.grade) === g);
}

const store = makeStore(window.localStorage);
async function load() {
  $('dash-error').textContent = '';
  const d = await api.teacherList(pin);
  roster = d.roster; records = d.records; undoInfo = d.undo || null; undoUI();
  savePrep(store, window.localStorage, roster, records); prepUI();   // 받아 올 때마다 이 태블릿에 자동 저장 (오프라인용)
}
/* ── 티어 이미지 위에 마우스를 올리거나(태블릿은 길게 누르면) 측정한 날짜를 네모 상자로 보여 준다 ── */
let tipEl = null, tipHoldUntil = 0, tipTimer = null;
const dateText = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d)); return m ? `${Number(m[2])}월 ${Number(m[3])}일${m[0] === today() ? '(오늘)' : ''}` : String(d); };
function tipShow(target, text) {
  if (!tipEl) { tipEl = el('div', { class: 'tip', role: 'tooltip' }); document.body.append(tipEl); }
  tipEl.textContent = text; tipEl.hidden = false;
  const r = target.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  tipEl.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  tipEl.style.top = `${r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8}px`;
}
function tipHide() { if (tipEl) tipEl.hidden = true; clearTimeout(tipTimer); }
function withTip(img, text) {
  img.setAttribute('aria-label', text); img.title = '';
  img.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') tipShow(img, text); });
  img.addEventListener('pointerleave', tipHide);
  let press = null, fired = false;
  img.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    fired = false; press = setTimeout(() => { fired = true; tipHoldUntil = Date.now() + 100000; tipShow(img, text); tipTimer = setTimeout(tipHide, 2500); }, 450);
  });
  const cancel = () => clearTimeout(press);
  img.addEventListener('pointerup', () => { cancel(); if (fired) { tipHoldUntil = Date.now() + 400; fired = false; } }); img.addEventListener('pointercancel', () => { cancel(); if (fired) { tipHoldUntil = Date.now() + 400; fired = false; } }); img.addEventListener('pointermove', (e) => { if (!fired) cancel(); });
  img.addEventListener('contextmenu', (e) => e.preventDefault());
  return img;
}
document.addEventListener('scroll', tipHide, true);

// 악력: 높은 기록이 왼손이면 (왼), 오른손이면 (오)
function handMark(it, rec) {
  const lr = TWO_HAND(it) && splitLR(rec.lr); if (!lr) return '';
  const l = Number(lr[0]), r = Number(lr[1]);
  return l === r ? ' (양손 같음)' : l > r ? ' (왼)' : ' (오)';
}
function renderDash() {
  const list = filtered(), table = $('table'); table.replaceChildren();
  table.append(el('tr', {}, el('th', {}, '이름'), el('th', {}, '학년'), ...ITEMS.map((i) => el('th', {}, i.label))));
  for (const s of list) {
    const tr = el('tr', {}, el('td', { class: 'name' }, el('button', { class: 'ghost gname', style: `--gc:${gradeColor(s.grade)};--gi:${gradeInk(s.grade)}`, onclick: () => openStudent(s) }, s.name)), el('td', {}, `${s.grade}`));
    for (const it of ITEMS) {
      const { rec, t } = curTier(s, it.key);
      const open = () => { if (Date.now() < tipHoldUntil) return; openCell(s, it); };
      tr.append(el('td', { class: 'cell', tabindex: '0', role: 'button', 'aria-label': `${s.name} ${it.label} 기록 입력`, onclick: open, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } },
        !rec ? el('span', { class: 'plus' }, '＋') : !s.sex ? '성별 필요' : el('div', {}, withTip(badge(t.index, true), `${TIERS[t.index]} · ${dateText(rec.date)} 측정`), el('div', { class: 'muted' }, `${fmt(it.key, rec.value)}${it.unit}${handMark(it, rec)}`))));
    }
    table.append(tr);
  }
}
function openStudent(s) {
  current = s; $('s-error').textContent = '';
  $('s-title').textContent = `${s.name} (${s.grade}학년${s.sex ? ' ' + s.sex : ', 성별 필요'})`;
  $('a-date').value = today(); $('a-value').value = ''; $('a-value2').value = ''; addSync();
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
    const dateIn = el('input', { type: 'date', value: r.date, 'aria-label': '날짜' }), lr = TWO_HAND(it) ? (splitLR(r.lr) || [String(r.value), '']) : null;
    const valIn = el('input', { value: lr ? lr[0] : String(r.value), inputmode: 'decimal', 'aria-label': lr ? '왼손 기록' : '기록' }), valIn2 = lr ? el('input', { value: lr[1], inputmode: 'decimal', 'aria-label': '오른손 기록', placeholder: '오른손' }) : null;
    if (lr) valIn.placeholder = '왼손';
    const del = el('button', { class: 'danger' }, '삭제');
    del.addEventListener('click', async () => {
      if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '정말 삭제'; return; }
      await run(() => api.teacherDelete(pin, r.recordId));
    });
    t.append(el('tr', {}, el('td', {}, dateIn), el('td', {}, it.label), el('td', {}, lr ? ['왼 ', valIn, ' 오 ', valIn2, ` ${it.unit}`] : [valIn, ` ${it.mmss ? '초' : it.unit}`]), el('td', {}, r.by), el('td', {}, tier ? tier.tier : '–'),
      el('td', {}, el('button', { onclick: () => run(() => api.teacherUpdate(pin, r.recordId, lr ? { value: valIn.value, left: valIn.value, right: valIn2.value, date: dateIn.value } : { value: valIn.value, date: dateIn.value })) }, '수정'), ' ', del)));
  }
  if (!mine.length) t.append(el('tr', {}, el('td', { colspan: 6, class: 'muted' }, '아직 기록이 없어요.')));
}
async function run(fn) {
  $('s-error').textContent = '';
  try { await fn(); await load(); renderStudent(); renderDash(); }
  catch (e) { $('s-error').textContent = e.message; }
}

/* ── 처리 중 화면: 로딩 → 초록 완료 문구(잠깐) ── */
function busy(p, msg) {
  const b = $(`${p}-busy`); b.hidden = false; b.className = 'cell-busy'; b.querySelector('.spinner').hidden = false; b.querySelector('p').textContent = msg;
}
async function busyOk(p, msg) {
  const b = $(`${p}-busy`); b.querySelector('.spinner').hidden = true; b.className = 'cell-busy ok'; b.querySelector('p').textContent = msg;
  await new Promise((r) => setTimeout(r, 900));
}
function busyEnd(p) { $(`${p}-busy`).hidden = true; }

/* ── 표의 칸을 눌러 바로 기록 입력·고치기 (숫자 키패드) ── */
let cellCur = null;   // { s, it, rec }
function cellExisting() {
  const { s, it } = cellCur, d = $('cell-date').value;
  const same = records.filter((r) => r.id === s.id && r.item === it.key && r.date === d);
  return same.length ? same[same.length - 1] : null;
}
function cellSync() {
  cellCur.rec = cellExisting(); const rec = cellCur.rec;
  if (TWO_HAND(cellCur.it)) { const lr = rec && splitLR(rec.lr); $('cell-val').value = rec ? (lr ? lr[0] : entryText(cellCur.it, rec.value)) : ''; $('cell-val2').value = lr ? lr[1] : ''; }
  else $('cell-val').value = rec ? entryText(cellCur.it, rec.value) : '';
  $('cell-note').textContent = rec ? '이 날짜에 이미 기록이 있어요. 저장하면 고쳐져요.' : '';
  $('cell-del').hidden = !rec; $('cell-del').dataset.armed = ''; $('cell-del').textContent = '이 기록 지우기';
  $('cell-save').textContent = rec ? '고치기' : '저장하기'; $('cell-error').textContent = '';
}
function openCell(s, it) {
  cellCur = { s, it, rec: null };
  $('cell-title').textContent = `${s.name} · ${it.label}`; $('cell-unit').textContent = unitOf(it);
  $('cell-date').value = today(); $('cell-minus').hidden = it.min >= 0;
  const dot = $('cell-pad').querySelector('[data-key="."]'); dot.disabled = !dotEnabled(it); dot.textContent = keyLabel(it, '.');
  const two = TWO_HAND(it); $('cell-disp2').hidden = !two; $('cell-side1').hidden = !two; $('cell-unit2').textContent = unitOf(it); cellActive(1);
  cellSync(); $('cell').hidden = false; $('cell-save').focus();
}
function closeCell() { $('cell').hidden = true; cellCur = null; }
const cellOn = () => (TWO_HAND(cellCur.it) && $('cell-val2').classList.contains('on') ? $('cell-val2') : $('cell-val'));
function cellActive(n) { $('cell-val').classList.toggle('on', n === 1 && TWO_HAND(cellCur.it)); $('cell-val2').classList.toggle('on', n === 2); }
$('cell-val').addEventListener('click', () => { if (cellCur && TWO_HAND(cellCur.it)) cellActive(1); });
$('cell-val2').addEventListener('click', () => { if (cellCur && TWO_HAND(cellCur.it)) cellActive(2); });
function cellPress(k) { $('cell-error').textContent = ''; const v = cellOn(); v.value = pressKey(cellCur.it, v.value, k); }
for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']) $('cell-pad').append(el('button', { type: 'button', 'data-key': k, class: k === '⌫' ? 'del' : '', 'aria-label': k === '⌫' ? '지우기' : k === '.' ? '소수점' : k }, k === '⌫' ? '지우기' : k));
$('cell-pad').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-key]'); if (b && cellCur && !b.disabled) cellPress(b.dataset.key); });
$('cell-minus').addEventListener('click', () => { const v = $('cell-val'); v.value = v.value.startsWith('-') ? v.value.slice(1) : '-' + v.value; });
$('cell-date').addEventListener('change', () => { if (cellCur) cellSync(); });
$('cell-close').addEventListener('click', closeCell);
$('cell').addEventListener('click', (ev) => { if (ev.target === $('cell')) closeCell(); });
$('cell-save').addEventListener('click', async () => {
  const { s, it } = cellCur, two = TWO_HAND(it), date = $('cell-date').value;
  if (!date) { $('cell-error').textContent = '날짜를 골라 주세요.'; return; }
  const pe = two ? parseHands(it, $('cell-val').value, $('cell-val2').value) : parseEntry(it, $('cell-val').value.trim());
  if (pe.error) { $('cell-error').textContent = pe.error; return; }
  const raw = pe.send, shown = two ? `${pe.left}/${pe.right}(높은 쪽 ${raw})` : $('cell-val').value.trim(), hands = two ? { left: pe.left, right: pe.right } : {};
  const was = cellCur.rec;
  $('cell-save').disabled = true; busy('cell', '데이터 업로드 중');
  try {
    if (was) await api.teacherUpdate(pin, was.recordId, { value: raw, date, ...hands });
    else await api.teacherAdd(pin, { id: s.id, date, item: it.key, value: raw, ...hands });
    await load(); renderDash(); $('dash-note').textContent = `${s.name} · ${it.label} ${shown}${it.unit}을(를) ${was ? '고쳤어요' : '저장했어요'}.`;
    await busyOk('cell', '저장되었습니다!'); closeCell();
  } catch (e) { $('cell-error').textContent = e.message; }
  finally { busyEnd('cell'); $('cell-save').disabled = false; }
});
$('cell-del').addEventListener('click', async () => {
  const b = $('cell-del');
  if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = '정말 지울까요? 한 번 더 누르세요'; return; }
  const was = cellCur.rec;
  busy('cell', '데이터 삭제 중');
  try {
    await api.teacherDelete(pin, was.recordId); await load(); renderDash(); $('dash-note').textContent = '기록을 지웠어요.';
    await busyOk('cell', '삭제되었습니다!'); closeCell();
  } catch (e) { $('cell-error').textContent = e.message; }
  finally { busyEnd('cell'); }
});

$('login').addEventListener('submit', async (ev) => {
  ev.preventDefault(); pin = $('pin').value; $('login-error').textContent = '';
  try { await load(); $('pin').value = ''; renderDash(); prepUI(); show(root, 'dash'); }
  catch (e) { pin = ''; $('login-error').textContent = e.message; }
});
const addSync = () => { const g = $('a-item').value === 'grip'; $('a-label2').hidden = !g; $('a-value').placeholder = g ? '왼손' : ''; $('a-value2').placeholder = '오른손'; };
$('a-item').addEventListener('change', addSync);
$('add').addEventListener('submit', (ev) => { ev.preventDefault(); const g = $('a-item').value === 'grip'; run(() => api.teacherAdd(pin, { id: current.id, date: $('a-date').value, item: $('a-item').value, value: $('a-value').value, ...(g ? { left: $('a-value').value, right: $('a-value2').value } : {}) })).then(() => { $('a-value').value = ''; $('a-value2').value = ''; }); });
$('f-grade').addEventListener('change', renderDash);
$('reload').addEventListener('click', async () => { try { await load(); renderDash(); } catch (e) { $('dash-error').textContent = e.message; } });
$('logout').addEventListener('click', () => { pin = ''; roster = []; records = []; show(root, 'login'); });
/* ── 학년 올리기: 교사용 비밀번호를 한 번 더 입력해야 실행, 실행 뒤에는 되돌리기 가능 ── */
attachPinPad($('promote-pin'));
$('promote').addEventListener('click', () => { $('dash-error').textContent = ''; $('promote-pin').value = ''; $('promote-pin').click(); });
$('promote-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const entered = $('promote-pin').value; $('promote-pin').value = '';
  if (!entered) return;
  if (entered !== pin) { $('dash-error').textContent = '비밀번호가 맞지 않아요. 학년은 그대로예요.'; return; }
  $('promote-dlg').hidden = false; busy('promote', '학년을 올리는 중');
  try {
    const r = await api.teacherPromote(entered); await load(); renderDash(); $('dash-error').textContent = '';
    $('dash-note').textContent = `진급 ${r.promoted}명, 졸업 ${r.graduated}명 처리했어요. 잘못 눌렀다면 [되돌리기]를 눌러 주세요.`;
    await busyOk('promote', '학년을 올렸어요!');
  } catch (e) { $('dash-error').textContent = e.message; }
  finally { busyEnd('promote'); $('promote-dlg').hidden = true; }
});
function undoUI() {
  const b = $('undo-promote'); if (!b) return;
  b.hidden = !undoInfo; b.dataset.armed = ''; b.textContent = undoInfo ? `되돌리기 (${undoInfo.at.slice(5, 10).replace('-', '월 ')}일 올림)` : '되돌리기';
}
$('undo-promote').addEventListener('click', async () => {
  const b = $('undo-promote');
  if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = '정말 되돌릴까요? 한 번 더 누르세요'; setTimeout(() => { if (undoInfo) undoUI(); }, 6000); return; }
  b.disabled = true; $('dash-note').textContent = '학년을 되돌리는 중이에요…';
  try { const r = await api.teacherPromoteUndo(pin); await load(); renderDash(); $('dash-error').textContent = ''; $('dash-note').textContent = `${r.restored}명을 올리기 전 학년으로 되돌렸어요.`; }
  catch (e) { $('dash-error').textContent = e.message; $('dash-note').textContent = ''; undoUI(); }
  finally { b.disabled = false; }
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

for (const sel of [$('a-item')]) for (const it of ITEMS) sel.append(el('option', { value: it.key }, sel.id === 'a-item' && it.mmss ? `${it.label} (초 단위로 입력)` : it.label));
$('ver').textContent = 'v40';
await loadTable();
attachPinPad($('pin'));   // 비밀번호는 숫자 키패드 창으로 입력
