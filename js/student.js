import { api } from './api.js';
import { DEV, ITEMS } from './config.js';
import { tierFor, bestOfDay, gradeKey } from './tiers.js';
import { loadTable, el, badge, show, fmt } from './ui.js';
import { startScan, normalize } from './qr.js';

const root = document.getElementById('app');
const $ = (id) => document.getElementById(id);
const IDLE_MS = 60000;
let me = null, idleTimer = null, picked = null, scanner = null;
const itemOf = (key) => ITEMS.find((i) => i.key === key);
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

function bumpIdle() { clearTimeout(idleTimer); if (me) idleTimer = setTimeout(logout, IDLE_MS); }
['pointerdown', 'keydown'].forEach((e) => document.addEventListener(e, bumpIdle));

function view(id) { show(root, id); bumpIdle(); }
function tierOf(r) { return tierFor(r.item, gradeKey(r.grade, me.sex), r.value); }

async function login(id) {
  $('scan-error').textContent = '';
  try {
    const d = await api.studentMe(id);
    me = { id: normalize(id), name: d.name, grade: d.grade, sex: d.sex, records: d.records };
    $('hello').textContent = `${me.name} (${me.grade}학년)`;
    view('home');
  } catch (e) { $('scan-error').textContent = e.message; startScanner(); }
}
function logout() { me = null; picked = null; clearTimeout(idleTimer); view('scan'); startScanner(); }
async function startScanner() {
  if (scanner) return;
  scanner = true;
  try { scanner = await startScan('reader', async (id) => { await stopScanner(); login(id); }); }
  catch (e) { scanner = null; if (!$('scan-error').textContent) $('scan-error').textContent = '카메라를 켤 수 없어요. 선생님께 알려 주세요.'; }
}
async function stopScanner() { const s = scanner; scanner = null; if (s && s.stop) { try { await s.stop(); } catch (e) {} } }

function renderItems() {
  const box = $('items'); box.replaceChildren();
  $('form').hidden = true; picked = null;
  for (const it of ITEMS) {
    box.append(el('button', { 'aria-pressed': 'false', onclick: (ev) => pick(it, ev.currentTarget) }, it.label, el('div', { class: 'muted' }, `단위: ${it.unit}`)));
  }
}
function pick(it, btn) {
  picked = it;
  $('items').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  $('form').hidden = false; $('form-error').textContent = '';
  $('value-label').textContent = `${it.label} 기록`; $('unit').textContent = it.unit;
  $('minus').hidden = it.min >= 0; $('value').value = ''; $('value').focus();
}
$('minus').addEventListener('click', () => { const v = $('value'); v.value = v.value.startsWith('-') ? v.value.slice(1) : '-' + v.value; v.focus(); });

$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const raw = $('value').value.trim().replace(',', '.');
  const n = Number(raw);
  if (raw === '' || !/^-?\d+(\.\d+)?$/.test(raw)) { $('form-error').textContent = '숫자로 입력해 주세요.'; return; }
  if (n < picked.min || n > picked.max) { $('form-error').textContent = `${picked.min}부터 ${picked.max} 사이의 숫자를 입력해 주세요.`; return; }
  $('save').disabled = true;
  try {
    const d = await api.studentAdd(me.id, picked.key, raw);
    me.records.push(d.record);
    showResult(d.record);
  } catch (e) { $('form-error').textContent = e.message; }
  finally { $('save').disabled = false; }
});

function showResult(rec) {
  const it = itemOf(rec.item), t = tierOf(rec), box = $('result'); box.replaceChildren();
  box.append(el('h2', {}, `${it.label} ${fmt(rec.item, rec.value)}${it.unit}`));
  if (!t) {
    box.append(el('p', {}, '기록을 저장했어요. 등급을 보려면 선생님께 성별 등록을 요청하세요.'));
  } else {
    box.append(badge(t.index), el('div', { class: 'big' }, t.tier));
    box.append(el('p', {}, t.next ? `${t.next.tier}까지 ${t.next.needed}${it.unit} ${rec.item === 'run50' ? '더 빨리' : '더'} 필요해요!` : '가장 높은 등급이에요! 대단해요!'));
  }
  const best = bestOfDay(me.records.filter((r) => r.id === me.id && r.item === rec.item && r.date === rec.date))[0];
  if (best && best.value !== rec.value) box.append(el('p', { class: 'muted' }, `오늘의 최고 기록은 ${fmt(rec.item, best.value)}${it.unit}이에요.`));
  view('result');
}

function chart(item, pts) {
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 300 110'); svg.setAttribute('class', 'chart'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${itemOf(item).label} 기록 변화`);
  const vals = pts.map((p) => p.value), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const lower = item === 'run50';
  const xy = pts.map((p, i) => {
    const x = pts.length === 1 ? 150 : 20 + (260 * i) / (pts.length - 1);
    const f = (p.value - lo) / span, y = 90 - 70 * (lower ? 1 - f : f);
    return [x, y];
  });
  const line = document.createElementNS(NS, 'polyline');
  line.setAttribute('points', xy.map((q) => q.join(',')).join(' ')); line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#ffd34d'); line.setAttribute('stroke-width', '3');
  svg.append(line);
  xy.forEach(([x, y]) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 5); c.setAttribute('fill', '#fff'); svg.append(c); });
  return svg;
}
function renderMine() {
  const box = $('mine'); box.replaceChildren();
  const mine = bestOfDay(me.records.filter((r) => r.id === me.id)).sort((a, b) => a.date.localeCompare(b.date));
  for (const it of ITEMS) {
    const pts = mine.filter((r) => r.item === it.key), card = el('div', { class: 'card' });
    const last = pts[pts.length - 1], t = last && tierOf(last);
    card.append(el('div', { class: 'head' }, t ? badge(t.index, true) : '', el('div', {}, el('strong', {}, it.label), el('div', { class: 'muted' }, last ? `${t ? t.tier : '등급 준비 중'} · 최근 ${fmt(it.key, last.value)}${it.unit}` : '아직 기록이 없어요'))));
    if (pts.length) card.append(chart(it.key, pts), el('div', { class: 'muted' }, `${pts[0].date} → ${last.date}`));
    box.append(card);
  }
}

$('go-record').addEventListener('click', () => { renderItems(); view('record'); });
$('go-mine').addEventListener('click', () => { renderMine(); view('mine'); });
$('to-mine').addEventListener('click', () => { renderMine(); view('mine'); });
$('again').addEventListener('click', () => { renderItems(); view('record'); });
$('logout').addEventListener('click', logout);
root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => view('home')));

await loadTable();
const devId = DEV && new URLSearchParams(location.search).get('id');
if (devId) login(devId); else startScanner();
