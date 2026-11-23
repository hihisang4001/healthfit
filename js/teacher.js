import { api } from './api.js';
import { ITEMS } from './config.js';
import { TIERS, tierFor, latestBest, gradeKey } from './tiers.js';
import { loadTable, el, badge, show, fmt } from './ui.js';

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
function renderStudent() {
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
$('s-back').addEventListener('click', () => { renderDash(); show(root, 'dash'); });

for (const sel of [$('f-item'), $('a-item')]) for (const it of ITEMS) sel.append(el('option', { value: it.key }, it.label));
await loadTable();
