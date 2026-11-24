// 교사용 [검사방법 안내] 화면 그리기
import { el } from './ui.js';
import { ITEMS } from './config.js';
import { GUIDE, GUIDE_NOTES, SCORE_TABLE, BMI } from './data/guide-data.js';
import { TIERS } from './tiers.js';
import { fmtValue } from './entry.js';
let tablePromise = null;
const loadCut = () => (tablePromise ||= fetch(new URL('./data/paps-tier-table.json', import.meta.url)).then((r) => r.json()));
const simple = (head, rows) => el('table', { class: 'gtable' }, el('thead', {}, el('tr', {}, ...head.map((h) => el('th', {}, h)))), el('tbody', {}, ...rows.map((r) => el('tr', {}, ...r.map((c, i) => el(i === 0 ? 'th' : 'td', {}, c))))));
function itemCard(g) {
  const it = ITEMS.find((x) => x.key === g.key);
  const kids = [
    el('div', { class: 'ghead' }, el('span', { class: 'garea' }, g.area), el('h3', {}, g.name), el('span', { class: g.rec ? 'gtag on' : 'gtag' }, g.rec ? '앱에서 기록' : '안내만'), el('span', { class: 'gtag' }, g.grades)),
    el('p', {}, el('b', {}, '준비물 '), g.need),
    el('ol', {}, ...g.how.map((h) => el('li', {}, h))),
    el('p', {}, el('b', {}, '기록 '), g.record),
  ];
  if (g.bmi) for (const sx of ['남', '여']) kids.push(el('p', { class: 'gsub' }, `BMI 분류 (${sx}학생)`), simple(['학년', '마름', '정상', '과체중', '경도비만', '고도비만'], BMI[sx]));
  if (it) kids.push(el('div', { class: 'gcut' }, el('div', { class: 'row' }, el('b', { class: 'grow' }, '이 앱의 티어 기준 (기록이 이 값 이상/이하이면 해당 티어)'), el('select', { 'aria-label': '성별' }, el('option', {}, '남'), el('option', {}, '여'))), el('div', { class: 'gcut-body' })));
  return el('section', { class: 'card gcard', id: `g-${g.key}` }, ...kids);
}
async function fillCut(card, key) {
  const t = await loadCut(), sx = card.querySelector('select').value, lower = (t.direction || {})[key];
  const cols = [3, 4, 5, 6].map((g) => { const k = `초${g}${sx}`; return { g, c: t.cutoffs[key][k], est: (t.estimated[k] || []).includes(key) }; });
  const rows = t.tiers_high_to_low.map((n) => [n, ...cols.map((x) => fmtValue(key, x.c[n]))]);   // 위: 높은 티어
  card.querySelector('.gcut-body').replaceChildren(simple(['티어', ...cols.map((x) => `초${x.g}${x.est ? ' (추정)' : ''}`)], rows), el('p', { class: 'muted' }, `${lower ? '낮을수록 좋은 기록이에요. 표의 값은 그 티어가 되려면 이 값 이하여야 하는 기준이에요.' : '표의 값은 그 티어가 되려면 이 값 이상이어야 하는 기준이에요.'} 이 값보다 못하면 아이언이에요. 추정은 공식 기준표가 없는 학년이에요.`));
}
export function renderGuide(box) {
  box.replaceChildren(
    el('div', { class: 'card' }, el('h2', {}, '기본 안내'), el('ul', {}, ...GUIDE_NOTES.map((n) => el('li', {}, n))), el('h3', {}, '등급·점수·티어'), simple(['PAPS 등급', '항목 점수', '티어'], SCORE_TABLE)),
    ...GUIDE.map(itemCard));
  for (const g of GUIDE) { const card = box.querySelector(`#g-${g.key}`); if (!card.querySelector('.gcut')) continue; card.querySelector('select').addEventListener('change', () => fillCut(card, g.key)); fillCut(card, g.key); }
}
