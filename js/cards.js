// QR 카드 탭: [아침 건강달리기]의 QR 카드와 같은 카드를 인쇄하거나 휴대폰 화면으로 보여 준다.
// 명단은 학생 이름이 들어 있어서 교사용 비밀번호를 넣은 뒤에만 불러온다.
import { api } from './api.js';
const $ = (id) => document.getElementById(id);
const GRADE_COLORS = { 1: '#D2412E', 2: '#E8742A', 3: '#E0A800', 4: '#22874E', 5: '#2D6CC8', 6: '#7B4FC2' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gradeOf = (p) => String(p.grade || '').replace(/학년/g, '').trim();
const colorOf = (g) => GRADE_COLORS[Number(g)] || '#5A6660';
const inkOf = (g) => (Number(g) === 3 ? '#2A2000' : '#fff');   // 노란색(3학년) 위에는 진한 글씨
const nameScale = (n) => { const k = [...String(n)].length; return k <= 4 ? 1 : k === 5 ? 0.8 : k === 6 ? 0.66 : 0.55; };   // 이름이 길면 줄인다
const gdot = (g) => `<i class="gdot" style="background:${colorOf(g)}"></i>`;
let roster = [], pvWake = null;

function qrSvg(text) {
  const q = window.qrcode(0, 'M'); q.addData(String(text)); q.make();
  const n = q.getModuleCount(), quiet = 2, size = n + quiet * 2; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR ${esc(text)}"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
// 카드 한 장 (인쇄 카드와 휴대폰으로 보기가 같이 쓴다)
function cardHTML(p) {
  const g = gradeOf(p), c = colorOf(g);
  return `<div class="qcard" data-id="${esc(p.id)}" style="--gc:${c};--gt:${c}1F;--gi:${inkOf(g)};--nf:${nameScale(p.name)}"><div>` +
    (g ? `<span class="gchip">${esc(g)}학년</span>` : '') +
    '<div class="school">내북초 아침 건강달리기</div>' +
    `<div class="nm">${esc(p.name)}</div><div class="code">${esc(p.id)}</div></div>` +
    `<div class="qrbox">${qrSvg(p.id)}</div></div>`;
}
function groupByGrade(list) {
  const groups = {}, order = [];
  list.forEach((p) => { const g = gradeOf(p); if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(p); });
  order.sort((a, b) => (Number(a) || 99) - (Number(b) || 99));
  return { groups, order };
}

/* ── 휴대폰으로 보기 ── */
function pickedRoster() {
  const on = {};
  $('pickGroups').querySelectorAll('input[data-id]').forEach((b) => { if (b.checked) on[b.dataset.id] = 1; });
  const list = roster.filter((p) => on[p.id]);
  return list.length ? list : roster;   // 아무도 안 골랐으면 전체
}
function openPhoneView() {
  if (!roster.length) return;
  const list = pickedRoster(), { groups, order } = groupByGrade(list);
  $('pvNames').innerHTML = order.map((g) => `<div class="pv-g">${gdot(g)}${esc(g ? g + '학년' : '학년 없음')}</div>` +
    groups[g].map((p) => `<button type="button" data-id="${esc(p.id)}" style="--gc:${colorOf(g)};--gi:${inkOf(g)}">${esc(p.name)}</button>`).join('')).join('');
  $('phoneView').hidden = false;
  showPhoneCard((order.length ? groups[order[0]][0] : list[0]).id);
  const el = $('phoneView');
  try {
    if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').then(refitPhoneQR, () => {});
      refitPhoneQR();
    }, () => {});
  } catch (e) {}
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { pvWake = w; }, () => {}); } catch (e) {}
  $('pvHint').hidden = false; setTimeout(() => { $('pvHint').hidden = true; }, 6000);
}
function showPhoneCard(id) {
  const p = roster.find((r) => r.id === id); if (!p) return;
  $('pvCard').innerHTML = cardHTML(p); fitPhoneQR();
  $('pvNames').querySelectorAll('button[data-id]').forEach((b) => { const on = b.dataset.id === id; b.classList.toggle('on', on); if (on) b.scrollIntoView({ block: 'nearest' }); });
}
// QR을 카드 높이에 꽉 차게 (먼저 작게 줄인 뒤 카드 높이를 잰다)
function fitPhoneQR() {
  const card = $('pvCard').querySelector('.qcard'), svg = card && card.querySelector('svg'); if (!svg) return;
  // 카드 크기의 기준 단위(--u): 화면 높이와 가로 폭 중 더 좁은 쪽에 카드가 맞게 한다 (세로 화면에서도 글자가 넘치지 않게)
  $('pvCard').style.setProperty('--u', Math.max(1, Math.min((window.innerHeight - 34) / 100, $('pvCard').clientWidth / 154.5)) + 'px');
  svg.style.width = svg.style.height = '40px';
  const cs = getComputedStyle(card), bs = getComputedStyle(card.querySelector('.qrbox'));
  const h = card.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(bs.paddingTop) * 2;
  svg.style.width = svg.style.height = Math.max(120, Math.floor(h)) + 'px';
}
function refitPhoneQR() { if ($('phoneView').hidden) return; fitPhoneQR(); [150, 400, 800].forEach((t) => setTimeout(() => { if (!$('phoneView').hidden) fitPhoneQR(); }, t)); }
function closePhoneView() {
  $('phoneView').hidden = true;
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
  try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (e) {}
  try { if (pvWake) { pvWake.release(); pvWake = null; } } catch (e) {}
}

/* ── 인쇄할 학생 고르기: 처음에는 모두 선택. 고른 학생의 카드만 아래에 보이고 그대로 인쇄된다 ── */
function buildPicker() {
  const { groups, order } = groupByGrade(roster);
  $('pickGroups').innerHTML = order.map((g) => `<div class="pick-g"><div><label class="gbtn" title="이 학년 모두 선택/해제"><input type="checkbox" class="gchk" data-gall="${esc(g)}" checked>${gdot(g)}${esc(g ? g + '학년' : '학년 없음')}</label></div><div class="pick-list">` +
    groups[g].map((p) => `<label class="on"><input type="checkbox" data-id="${esc(p.id)}" data-g="${esc(g)}" checked>${esc(p.name)}</label>`).join('') + '</div></div>').join('');
  $('cardPick').hidden = !roster.length;
  const boxes = () => [...$('pickGroups').querySelectorAll('input[data-id]')];
  function apply() {
    const on = {}; let n = 0;
    boxes().forEach((b) => { if (b.checked) { on[b.dataset.id] = 1; n++; } b.parentNode.classList.toggle('on', b.checked); });
    $('pickGroups').querySelectorAll('input[data-gall]').forEach((gc) => {   // 모두 고르면 체크, 일부만이면 '－'
      const mine = boxes().filter((b) => b.dataset.g === gc.dataset.gall), k = mine.filter((b) => b.checked).length;
      gc.checked = k === mine.length; gc.indeterminate = k > 0 && k < mine.length; gc.parentNode.classList.toggle('on', k === mine.length);
    });
    $('cardSheet').querySelectorAll('.qcard').forEach((c) => { c.hidden = !on[c.dataset.id]; });
    const pages = Math.ceil(n / 10);
    $('pickCount').textContent = n === roster.length ? `전체 ${n}명 · A4 ${pages}장` : n ? `${n}명 선택 · A4 ${pages}장` : '아무도 고르지 않았어요';
    $('printBtn').disabled = !n;
    $('printBtn').textContent = n === roster.length ? '전체 인쇄하기' : n ? `${n}명 인쇄하기` : '학생을 골라 주세요';
  }
  $('pickGroups').addEventListener('change', (ev) => {
    const gc = ev.target.closest('input[data-gall]');
    if (gc) boxes().forEach((b) => { if (b.dataset.g === gc.dataset.gall) b.checked = gc.checked; });
    apply();
  });
  $('pickAll').onclick = () => { boxes().forEach((b) => { b.checked = true; }); apply(); };
  $('pickNone').onclick = () => { boxes().forEach((b) => { b.checked = false; }); apply(); };
  apply();
}

$('printBtn').addEventListener('click', () => window.print());
$('phoneBtn').addEventListener('click', openPhoneView);
$('pvClose').addEventListener('click', closePhoneView);
$('pvNames').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-id]'); if (b) showPhoneCard(b.dataset.id); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && !$('phoneView').hidden) closePhoneView(); refitPhoneQR(); });
window.addEventListener('resize', refitPhoneQR);
window.addEventListener('orientationchange', refitPhoneQR);

$('login').addEventListener('submit', async (ev) => {
  ev.preventDefault(); $('login-error').textContent = '';
  try {
    const d = await api.teacherList($('pin').value);
    if (!window.qrcode) throw new Error('QR 프로그램을 불러오지 못했어요. 새로고침해 주세요.');
    roster = (d.roster || []).slice().sort((a, b) => (a.grade - b.grade) || String(a.id).localeCompare(String(b.id)));
    $('pin').value = '';
    $('cardSheet').innerHTML = roster.map(cardHTML).join('');
    buildPicker();
    $('cards-login').hidden = true; $('v-cards').hidden = false;
  } catch (e) { $('login-error').textContent = e.message; }
});
