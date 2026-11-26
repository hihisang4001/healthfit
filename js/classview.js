// 교사용 현황판의 반 전체 계산과 상세 그래프·표 (학생용 [내 기록]과 같은 모양)
import { ITEMS } from './config.js';
import { TIERS, tierFor, bestOfDay, gradeKey } from './tiers.js';
import { LOWER, needText } from './entry.js';
import { el, badge, fmt } from './ui.js';

const itemOf = (k) => ITEMS.find((i) => i.key === k);
const better = (item, a, b) => (LOWER.has(item) ? a < b : a > b);

// 기록에 나온 측정 날짜들(최근 날짜가 먼저)
export const dateList = (records) => [...new Set(records.map((r) => r.date))].sort().reverse();

// 학생·종목의 기록: date가 있으면 그날 최고 기록, 없으면 가장 최근 측정일의 최고 기록
export function recFor(records, sid, item, date) {
  const mine = bestOfDay(records.filter((r) => r.id === sid && r.item === item)).sort((a, b) => b.date.localeCompare(a.date));
  return (date ? mine.find((r) => r.date === date) : mine[0]) || null;
}
// rec 바로 앞 측정일의 최고 기록
export function prevRec(records, sid, item, rec) {
  if (!rec) return null;
  const mine = bestOfDay(records.filter((r) => r.id === sid && r.item === item && r.date < rec.date)).sort((a, b) => b.date.localeCompare(a.date));
  return mine[0] || null;
}
// 이전 기록보다 등급이 오른 칸인가
export function tierUp(records, s, item, rec, tierIndex) {
  const key = gradeKey(s.grade, s.sex), p = prevRec(records, s.id, item, rec), pt = p && key ? tierFor(item, key, p.value) : null;
  return !!(pt && tierIndex > pt.index);
}
// 종목 하나의 반 요약: 등급별 인원, 평균, 최고 기록(+학생 이름)
export function itemStats(rows, item) {   // rows: [{ s, rec, t }]
  const counts = new Array(TIERS.length).fill(0);
  let sum = 0, n = 0, best = null;
  for (const { s, rec, t } of rows) {
    if (!rec) continue;
    sum += rec.value; n++;
    if (t) counts[t.index]++;
    if (!best || better(item, rec.value, best.rec.value)) best = { s, rec };
    else if (rec.value === best.rec.value) best.more = (best.more || 0) + 1;
  }
  return { counts, n, avg: n ? sum / n : null, best };
}
// 같은 학년·성별 친구들의 날짜별 평균 (그날 측정한 사람이 본인 포함 2명 이상일 때만)
export function groupAvg(roster, records, s, item) {
  const mates = roster.filter((x) => String(x.grade) === String(s.grade) && x.sex && x.sex === s.sex);
  const byDate = new Map();
  for (const m of mates) for (const r of bestOfDay(records.filter((q) => q.id === m.id && q.item === item))) {
    const a = byDate.get(r.date) || { sum: 0, n: 0 }; a.sum += r.value; a.n++; byDate.set(r.date, a);
  }
  const out = new Map();
  for (const [d, a] of byDate) if (a.n >= 2) out.set(d, { avg: a.sum / a.n, n: a.n });
  return out;
}
// 학생의 종목별 현재(최신) 등급으로 강점·약점 종목 뽑기 (등급이 서로 다를 때만)
export function strengths(records, s) {
  const key = gradeKey(s.grade, s.sex); if (!key) return null;
  const rows = [];
  for (const it of ITEMS) { const rec = recFor(records, s.id, it.key, ''); const t = rec && tierFor(it.key, key, rec.value); if (t) rows.push({ it, t }); }
  if (rows.length < 2) return { rows, top: [], low: [] };
  const hi = Math.max(...rows.map((r) => r.t.index)), lo = Math.min(...rows.map((r) => r.t.index));
  if (hi === lo) return { rows, top: [], low: [] };
  return { rows, top: rows.filter((r) => r.t.index === hi), low: rows.filter((r) => r.t.index === lo) };
}

// 평균 표시: 정수 종목은 소수 첫째 자리, 오래달리기는 초 단위 반올림
export const fmtAvg = (key, v) => (key === 'long_run' ? fmt(key, Math.round(v)) : key === 'run50' || key === 'grip' ? fmt(key, v) : String(Math.round(v * 10) / 10));
const md = (d) => { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(d); return m ? `${Number(m[1])}/${Number(m[2])}` : d; };
// 꺾은선 그래프(학생용과 같은 모양). avg: Map(날짜 → {avg,n}) 이 있으면 점선 비교선을 겹친다
export function lineChart(it, pts, avg) {
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  const W = 320, H = 170, L = 46, R = 24, T = 26, B = 36;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'chart'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${it.label} 기록 변화`);
  const mk = (tag, at, txt) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) n.setAttribute(k, v); if (txt !== undefined) n.textContent = txt; svg.append(n); return n; };
  const avgs = avg ? pts.map((p) => (avg.get(p.date) ? avg.get(p.date).avg : null)) : pts.map(() => null);
  const all = [...pts.map((p) => p.value), ...avgs.filter((v) => v != null)];
  const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1, lower = LOWER.has(it.key), yTop = T, yBot = H - B;
  const yOf = (v) => { const f = hi === lo ? 0.5 : (v - lo) / span; return yBot - (yBot - yTop) * (lower ? 1 - f : f); };
  const xOf = (i) => (pts.length === 1 ? (L + W - R) / 2 : L + ((W - L - R) * i) / (pts.length - 1));
  mk('line', { x1: L, y1: yTop - 6, x2: L, y2: yBot + 6, stroke: '#9AA6A0', 'stroke-width': 1 });
  mk('line', { x1: L, y1: yBot + 6, x2: W - R, y2: yBot + 6, stroke: '#9AA6A0', 'stroke-width': 1 });
  const best = lower ? lo : hi, worst = lower ? hi : lo;
  mk('text', { x: L - 5, y: yTop + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#5A6660' }, fmt(it.key, best));
  if (hi !== lo) mk('text', { x: L - 5, y: yBot + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#5A6660' }, fmt(it.key, worst));
  mk('text', { x: 4, y: 12, 'font-size': 11, fill: '#5A6660' }, it.unit || '');
  const aPts = avgs.map((v, i) => (v == null ? null : [xOf(i), yOf(v)]));
  if (aPts.some(Boolean)) {   // 반 평균 비교선(회색 점선)
    const seg = aPts.filter(Boolean);
    if (seg.length > 1) mk('polyline', { points: seg.map((q) => q.join(',')).join(' '), fill: 'none', stroke: '#7A8680', 'stroke-width': 2, 'stroke-dasharray': '5 4' });
    seg.forEach(([x, y]) => mk('circle', { cx: x, cy: y, r: 3.5, fill: '#fff', stroke: '#7A8680', 'stroke-width': 2 }));
  }
  const xy = pts.map((p, i) => [xOf(i), yOf(p.value)]);
  mk('polyline', { points: xy.map((q) => q.join(',')).join(' '), fill: 'none', stroke: '#22704A', 'stroke-width': 3 });
  xy.forEach(([x, y], i) => {
    mk('circle', { cx: x, cy: y, r: 5, fill: '#C4432B' });
    mk('text', { x, y: y - 9, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#1C2420' }, fmt(it.key, pts[i].value));
    mk('line', { x1: x, y1: yBot + 6, x2: x, y2: yBot + 10, stroke: '#9AA6A0', 'stroke-width': 1 });
    mk('text', { x, y: yBot + 22, 'text-anchor': 'middle', 'font-size': 11, fill: '#5A6660' }, md(pts[i].date));
  });
  return svg;
}
// 날짜·측정값·등급(·반 평균) 표. 최고 기록 행은 노란 배경 + 다음 등급까지
export function recTable(it, pts, s, avg) {
  const key = gradeKey(s.grade, s.sex), lower = LOWER.has(it.key);
  let bestR = pts[0]; for (const r of pts) if (better(it.key, r.value, bestR.value)) bestR = r;
  const showAvg = avg && avg.size;
  const rows = pts.map((r) => {
    const t = key ? tierFor(it.key, key, r.value) : null, isBest = r === bestR, a = avg && avg.get(r.date);
    let need = '–';
    if (isBest) need = !t ? '–' : t.next ? el('span', {}, el('b', {}, t.next.tier), ' 까지 ', el('b', {}, needText(it, t.next.needed)), ` ${lower ? '더 빨리' : '더'}`) : '가장 높은 등급!';
    return el('tr', { class: isBest ? 'best' : '' }, el('td', {}, r.date), el('td', {}, `${fmt(it.key, r.value)}${it.unit}`, isBest ? el('span', { class: 'bestmark' }, ' 최고') : ''),
      el('td', {}, t ? el('span', { class: 'tcell' }, badge(t.index, true), t.tier) : '–'),
      ...(showAvg ? [el('td', { class: 'muted' }, a ? `${fmtAvg(it.key, a.avg)}${it.unit} (${a.n}명)` : '–')] : []),
      el('td', { class: 'need' }, need));
  });
  return el('table', { class: 'rtable' }, el('thead', {}, el('tr', {}, el('th', {}, '날짜'), el('th', {}, '측정값'), el('th', {}, '등급'), ...(showAvg ? [el('th', {}, '같은 학년·성별 평균')] : []), el('th', {}, '다음 등급까지'))), el('tbody', {}, ...rows));
}
export { itemOf };
