import { api, onNet } from './api.js';
import { makeStore, newCid } from './offline.js';
import { DEV, ITEMS } from './config.js';
import { playTier, unlock, isMuted, setMuted } from './sound.js';
import { tierFor, bestOfDay, gradeKey, isImplausible } from './tiers.js';
import { loadTable, el, badge, show, fmt } from './ui.js';
import { startScan, normalize } from './qr.js';

const root = document.getElementById('app');
const store = makeStore((() => { try { return window.localStorage; } catch (e) { return { getItem() { return null; }, setItem() { throw new Error('저장소 없음'); } }; } })());
const $ = (id) => document.getElementById(id);
const IDLE_MS = 60000;
const RESULT_MS = 10000;
let me = null, idleTimer = null, picked = null, scanner = null, resultTimer = null, tick = null, lastSave = null, askedFor = null;
const itemOf = (key) => ITEMS.find((i) => i.key === key);
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

function bumpIdle() { clearTimeout(idleTimer); if (me) idleTimer = setTimeout(logout, IDLE_MS); }
['pointerdown', 'keydown'].forEach((e) => document.addEventListener(e, bumpIdle));

function view(id) { show(root, id); bumpIdle(); }
function tierOf(r) { return tierFor(r.item, gradeKey(r.grade, me.sex), r.value); }

// 카메라는 계속 켜 둔다. 읽히면 잠깐 멈췄다가(pause) 다음 학생 때 다시 이어서(resume) 쓴다.
async function login(id) {
  $('scan-error').textContent = '';
  // 기다리지 않고 바로 다음 화면부터 보여 준다 (이름·학년은 서버에서 오는 대로 채움)
  me = { id: normalize(id), name: '', grade: 0, sex: '', records: [], loading: true };
  $('hello').textContent = '불러오는 중…';
  $('go-record').disabled = $('go-mine').disabled = true;
  view('loading');
  try { scanner && scanner.pause && scanner.pause(true); } catch (e) {}
  try {
    const d = await api.studentMe(id);
    if (!me || me.id !== normalize(id)) return;
    store.cachePut(me.id, d);
    startMe(d);
    if (store.queue().length) flush();
  } catch (e) {
    if (!me || me.id !== normalize(id)) return;
    const c = e.offline && store.cacheGet(me.id);
    if (c) { startMe(c); return; }   // 인터넷이 없어도, 이 기기가 아는 학생이면 이어서 쓴다
    me = null;
    $('scan-error').textContent = e.offline ? '인터넷이 끊겨 있고 이 기기에 저장되지 않은 카드예요. 선생님께 알려 주세요.' : e.message;
    view('scan'); resumeScanner();
  }
}
function startMe(d) {
  Object.assign(me, { name: d.name, grade: d.grade, sex: d.sex, records: [...d.records, ...store.pendingRecords(me.id, d.grade)], peers: d.peers || {}, loading: false });
  $('hello').textContent = `${me.name} (${me.grade}학년)`;
  $('go-record').disabled = $('go-mine').disabled = false;
  view('home');
}
function resumeScanner() {
  if (!scanner || scanner === true) return startScanner();
  try { scanner.resume(); } catch (e) {}
  scanner.__ready && scanner.__ready();
}
function logout() { stopResultTimer(); me = null; picked = null; clearTimeout(idleTimer); view('scan'); resumeScanner(); }
async function startScanner() {
  if (scanner) return;
  scanner = true;
  $('cam-retry').hidden = true;
  // 6초가 지나도 카메라가 안 켜지면(허용 창이 안 보이거나 멈춘 경우) 안내와 다시 켜기 버튼을 보여 준다
  const slowTimer = setTimeout(() => { if (scanner === true) { $('scan-error').textContent = '카메라가 켜지지 않고 있어요. 카메라 허용 창이 떠 있으면 \'허용\'을 눌러 주세요.'; $('cam-retry').hidden = false; } }, 6000);
  try { scanner = await startScan('reader', (id) => login(id)); clearTimeout(slowTimer); $('scan-error').textContent = ''; $('cam-retry').hidden = true; }
  catch (e) {
    clearTimeout(slowTimer); scanner = null;
    const why = { NotAllowedError: '카메라 사용이 막혀 있어요. 브라우저 설정에서 카메라를 허용해 주세요.', NotFoundError: '카메라를 찾지 못했어요.', NotReadableError: '다른 앱이 카메라를 쓰고 있어요. 그 앱을 닫아 주세요.', OverconstrainedError: '이 기기의 카메라를 켤 수 없어요.' }[e && e.name];
    if (!$('scan-error').textContent) $('scan-error').textContent = (why || '카메라를 켤 수 없어요.') + ` (${(e && (e.name || e.message)) || '원인 알 수 없음'})`;
    $('cam-retry').hidden = false;
  }
}
$('cam-retry').addEventListener('click', () => location.reload());   // 멈춘 카메라 상태를 지우려면 화면을 새로 여는 것이 가장 확실하다

function renderItems() {
  const box = $('items'); box.replaceChildren(); box.classList.remove('has-pick'); box.hidden = false;
  $('form').hidden = true; picked = null; $('rec-title').textContent = '오늘 측정한 항목을 골라요';
  for (const it of ITEMS) {
    box.append(el('button', { 'data-item': it.key, 'aria-pressed': 'false', onclick: (ev) => pick(it, ev.currentTarget) }, it.label, el('div', { class: 'muted' }, `단위: ${it.unit}`)));
  }
}
const decimalsOf = (it) => { const m = String(it.step).split('.')[1]; return m ? m.length : 0; };
// 화면 안의 숫자 키패드: 기기 키보드는 쓰지 않는다
function buildPad() {
  const pad = $('pad'); pad.replaceChildren();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
  for (const k of keys) pad.append(el('button', { type: 'button', 'data-key': k, class: k === '⌫' ? 'del' : '', 'aria-label': k === '⌫' ? '지우기' : k === '.' ? '소수점' : k }, k === '⌫' ? '지우기' : k));
}
function press(k) {
  resetAsk();
  const v = $('value'); let t = v.value; $('form-error').textContent = '';
  const dec = decimalsOf(picked);
  if (k === '⌫') t = t.slice(0, -1);
  else if (k === '.') { if (dec && t !== '' && t !== '-' && !t.includes('.')) t += '.'; }
  else {
    const frac = t.split('.')[1];
    if (t.replace('-', '').replace('.', '').length >= 6) return;
    if (frac !== undefined && frac.length >= dec) return;
    t = (t === '0' ? '' : t === '-0' ? '-' : t) + k;
  }
  v.value = t;
}
function pick(it, btn) {
  picked = it;
  $('items').hidden = true; $('rec-title').textContent = '';
  $('form').hidden = false; $('form').dataset.item = it.key; $('form-error').textContent = '';
  $('value-label').replaceChildren(it.label, el('small', {}, `단위: ${it.unit}`)); $('unit').textContent = it.unit;
  resetAsk(); $('minus').hidden = it.min >= 0; $('value').value = '';
  $('pad').querySelector('[data-key="."]').disabled = !decimalsOf(it);
}
$('pad') && buildPad();
$('pad').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-key]'); if (b && picked && !b.disabled) press(b.dataset.key); });
$('minus').addEventListener('click', () => { resetAsk(); const v = $('value'); v.value = v.value.startsWith('-') ? v.value.slice(1) : '-' + v.value; });

$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const raw = $('value').value.trim().replace(',', '.');
  const n = Number(raw);
  if (raw === '' || !/^-?\d+(\.\d+)?$/.test(raw)) { $('form-error').textContent = '숫자를 눌러 입력해 주세요.'; return; }
  if (n < picked.min || n > picked.max) { $('form-error').textContent = `${picked.min}부터 ${picked.max} 사이의 숫자를 입력해 주세요.`; return; }
  // 평소와 크게 다른 값: 큰 팝업으로 한 번 더 확인
  if (isImplausible(picked.key, gradeKey(me.grade, me.sex), n)) {
    askConfirm(`정말 ${raw}${picked.unit}가 맞아요?`).then((yes) => { if (yes) doSave(raw, n); });
    return;
  }
  doSave(raw, n);
});
function askConfirm(msg) {
  return new Promise((resolve) => {
    const box = $('confirm'); $('confirm-msg').textContent = msg; box.hidden = false; $('confirm-yes').focus();
    const done = (v) => { box.hidden = true; $('confirm-yes').onclick = $('confirm-no').onclick = null; resolve(v); };
    $('confirm-yes').onclick = () => done(true); $('confirm-no').onclick = () => done(false);
  });
}
async function doSave(raw, n) {
  $('save').disabled = true;
  // 저장 결과를 기다리지 않고 바로 등급 화면을 보여 주고, 저장은 뒤에서 확인한다
  const who = me, key = picked.key, cid = newCid(), date = today();
  const rec = { id: who.id, item: key, value: n, grade: who.grade, date, cid };
  who.records.push(rec);
  const drop = () => { const i = who.records.indexOf(rec); if (i >= 0) who.records.splice(i, 1); };
  const promise = api.studentAdd(who.id, key, raw, { cid, date }).then((d) => {
    const i = who.records.indexOf(rec); if (i >= 0) who.records[i] = d.record;
    Object.assign(rec, d.record); store.cacheAddRecord(who.id, d.record); setSaved('저장했어요 ✓', false); return d.record;
  }).catch((e) => {
    // 인터넷이 끊겼으면 기록을 기기에 담아 두었다가 연결되면 자동으로 보낸다
    if (e.offline && store.enqueue({ cid, id: who.id, item: key, value: raw, date })) {
      rec.pending = true; pendingRecs.set(cid, rec);
      setSaved('인터넷이 끊겨 기기에 저장했어요. 연결되면 자동으로 보내요', false, 'pending'); setNet();
      return { pending: true, cid };
    }
    drop();
    stopResultTimer(); setSaved(`저장하지 못했어요. ${e.message} 다시 기록해 주세요.`, true); $('undo') && ($('undo').hidden = true); return null;
  });
  lastSave = { rec, promise };
  showResult(rec, true);
  promise.finally(() => { $('save').disabled = false; });
}
$('value').addEventListener('input', resetAsk);
function resetAsk() { askedFor = null; $('save').textContent = '저장하기'; }
function setSaved(msg, bad, kind) { const p = $('save-state'); if (p) { p.textContent = msg; p.className = bad ? 'error' : (kind || (msg.startsWith('저장했어요') ? 'saved' : 'muted')); } }

function stopResultTimer() { clearTimeout(resultTimer); clearInterval(tick); resultTimer = tick = null; }
function startResultTimer() {
  stopResultTimer();
  let left = Math.round(RESULT_MS / 1000);
  const label = () => { const b = $('undo'); if (b) b.textContent = `잘못 입력했어요 (${left})`; };
  label();
  tick = setInterval(() => { left -= 1; label(); }, 1000);
  resultTimer = setTimeout(logout, RESULT_MS);   // 10초 뒤 다음 학생을 위해 처음 화면으로
}
async function undoLast() {
  if (!lastSave) return;
  stopResultTimer();
  const b = $('undo'); b.disabled = true; b.textContent = '취소하는 중…';
  const saved = await lastSave.promise;
  if (!saved) return;
  const rec = lastSave.rec, itemKey = rec.item;
  try {
    if (saved.pending && store.removeQueued(saved.cid)) {
      pendingRecs.delete(saved.cid);   // 아직 보내지 않은 기록은 기기에서 지우면 끝
      setNet();
    } else {
      const recordId = saved.recordId || rec.recordId;
      if (!recordId) throw new Error('방금 보낸 기록을 찾지 못했어요. 선생님께 말씀해 주세요.');
      await api.studentUndo(me.id, recordId);
      store.cacheRemoveRecord(me.id, recordId);
    }
    const i = me.records.indexOf(rec); if (i >= 0) me.records.splice(i, 1);
    lastSave = null; renderItems(); view('record');
    $('rec-title').textContent = '취소했어요. 다시 골라요';
    askUndone(itemKey);
  } catch (e) { setSaved(e.offline ? '인터넷이 끊겨서 지금은 취소할 수 없어요. 선생님께 말씀해 주세요.' : e.message, true); b.hidden = true; }
}
// 취소 완료 팝업: '다시 기록하기'는 방금 고른 종목의 입력 화면으로 바로 간다
function askUndone(itemKey) {
  const box = $('undone'), it = ITEMS.find((x) => x.key === itemKey);
  $('undone-msg').textContent = it ? `${it.label} 기록을 취소했어요` : '기록을 취소했어요';
  box.hidden = false; $('undone-again').focus();
  const done = (again) => { box.hidden = true; $('undone-again').onclick = $('undone-close').onclick = null; if (again && it) pick(it); };
  $('undone-again').onclick = () => done(true); $('undone-close').onclick = () => done(false);
}
function showResult(rec, pending = false) {
  const it = itemOf(rec.item), t = tierOf(rec), box = $('result'); box.replaceChildren();
  box.append(el('h2', {}, `${it.label} ${fmt(rec.item, rec.value)}${it.unit}`));
  if (!t) {
    box.append(el('p', {}, '기록을 저장했어요. 등급을 보려면 선생님께 성별 등록을 요청하세요.'));
  } else {
    box.append(badge(t.index), el('div', { class: 'big' }, t.tier));
    box.append(t.next ? el('p', { class: 'next-tier' }, badge(t.index + 1, true), el('span', {}, `${t.next.tier}까지 `, el('b', {}, `${t.next.needed}${it.unit}`), ` ${rec.item === 'run50' ? '더 빨리' : '더'} 필요해요!`)) : el('p', {}, '가장 높은 등급이에요! 대단해요!'));
    const pm = me.peers && me.peers[rec.item], pt = pm && tierFor(rec.item, gradeKey(me.grade, me.sex), pm.mean);
    if (pt) box.append(el('div', { class: 'peer' }, '같은 학년·성별 친구 평균', badge(pt.index, true), el('b', {}, pt.tier)));   // 비교할 친구가 없으면 아무것도 보이지 않는다
  }
  const best = bestOfDay(me.records.filter((r) => r.id === me.id && r.item === rec.item && r.date === rec.date))[0];
  if (best && best.value !== rec.value) box.append(el('p', { class: 'muted' }, `오늘의 최고 기록은 ${fmt(rec.item, best.value)}${it.unit}이에요.`));
  box.append(el('p', { id: 'save-state', class: 'muted' }, pending ? '저장하는 중…' : ''));
  const ub = $('undo'); ub.hidden = false; ub.disabled = false; ub.textContent = '잘못 입력했어요';   // 취소 버튼은 '내 기록 보기' 옆의 큰 버튼
  view('result'); startResultTimer();
  if (t) playTier(t.index);
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
  line.setAttribute('points', xy.map((q) => q.join(',')).join(' ')); line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#22704A'); line.setAttribute('stroke-width', '3');
  svg.append(line);
  xy.forEach(([x, y]) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 5); c.setAttribute('fill', '#C4432B'); svg.append(c); });
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
$('to-mine').addEventListener('click', stopResultTimer, true);
$('to-mine').addEventListener('click', () => { renderMine(); view('mine'); });
$('undo').addEventListener('click', undoLast);
$('logout').addEventListener('click', logout);
root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { if (b.closest('[data-view=record]') && !$('form').hidden) renderItems(); else view('home'); }));

// ---------- 인터넷 연결·전송 상태 표시, 끊겼을 때 쌓인 기록 자동 전송 ----------
const pendingRecs = new Map();
let netOk = navigator.onLine !== false, flushing = false, sentAt = 0;
function setNet() {
  const n = $('net'); if (!n) return;
  const q = store.queue().length, f = store.failed().length, online = netOk && navigator.onLine !== false;
  let state, text;
  if (f) { state = 'fail'; text = `전송 실패 ${f}건 · 선생님께 알려 주세요`; }
  else if (!online) { state = 'off'; text = q ? `인터넷 끊김 · 전송 대기 ${q}건` : '인터넷 끊김 · 기록은 기기에 저장돼요'; }
  else if (flushing || q) { state = 'sync'; text = `전송 중 · ${q}건`; }
  else if (Date.now() - sentAt < 6000) { state = 'ok'; text = '전송 완료 ✓'; }
  else { state = 'ok'; text = '인터넷 연결됨'; }
  n.dataset.state = state; n.textContent = text;
}
function onSent(it, record) {
  const rec = pendingRecs.get(it.cid);
  if (rec) { Object.assign(rec, record); delete rec.pending; pendingRecs.delete(it.cid); if (lastSave && lastSave.rec === rec) setSaved('저장했어요 ✓', false); }
  store.cacheAddRecord(it.id, record);
}
async function flush() {
  if (flushing) return;
  flushing = true; setNet();
  try {
    for (;;) {
      const it = store.queue()[0]; if (!it) break;
      try {
        const d = await api.studentAdd(it.id, it.item, it.value, { cid: it.cid, date: it.date });
        store.removeQueued(it.cid); onSent(it, d.record); sentAt = Date.now(); setTimeout(setNet, 6100);
      } catch (e) {
        if (e.offline) break;
        store.markFailed(it, e.message);   // 서버가 거절한 기록은 따로 보관하고 다음 기록으로 넘어간다
      }
    }
  } finally { flushing = false; setNet(); }
}
onNet((ok) => { netOk = ok; setNet(); if (ok && !flushing && store.queue().length) flush(); });
window.addEventListener('online', () => { netOk = true; setNet(); flush(); });
window.addEventListener('offline', () => { netOk = false; setNet(); });
setInterval(() => { if (store.queue().length) flush(); else if (!netOk) api.ping().catch(() => {}); }, 15000);
setNet();
if (DEV) { window.__login = login; window.__flush = flush; }

// 새 버전이 올라오면 저절로 새로 고침한다 (태블릿에 옛 화면이 남아 있는 문제 방지)
const BUILD = '22';
$('ver').textContent = 'v' + BUILD;
fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((d) => {
  if (d && d.v && d.v !== BUILD && new URLSearchParams(location.search).get('v') !== d.v) location.replace(location.pathname + '?v=' + d.v);
}).catch(() => {});
const tableReady = loadTable();
const devId = DEV && new URLSearchParams(location.search).get('id');
if (devId) { await tableReady; login(devId); } else startScanner();
// 주소 끝에 ?nosw=1 을 붙여 한 번 열면, 이 기기의 오프라인 보관 기능(서비스 워커)을 끄고 보관 파일을 지운다(문제 원인 확인용)
try { if (new URLSearchParams(location.search).get('nosw') === '1') localStorage.setItem('hf-nosw', '1'); if (new URLSearchParams(location.search).get('nosw') === '0') localStorage.removeItem('hf-nosw'); } catch (e) {}
let noSw = false; try { noSw = localStorage.getItem('hf-nosw') === '1'; } catch (e) {}
if ('serviceWorker' in navigator && noSw) {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
  $('ver').textContent += ' (오프라인 보관 꺼짐)';
} else if ('serviceWorker' in navigator && !devId) navigator.serviceWorker.register('sw.js').catch(() => {});   // 인터넷이 없어도 앱 화면이 열리게 기기에 보관
await tableReady;
// 앱스크립트 서버를 미리 깨워 둔다(처음 요청이 느린 것을 줄임)
api.warm();

// 효과음: 첫 터치에서 소리를 깨우고, 상단 스피커 버튼으로 끄고 켠다
document.addEventListener('pointerdown', unlock, { once: true });
{ const b = $('mute'); const paint = () => { b.textContent = isMuted() ? '🔇' : '🔊'; b.setAttribute('aria-label', isMuted() ? '효과음 꺼짐' : '효과음 켜짐'); };
  paint(); b.onclick = () => { setMuted(!isMuted()); paint(); if (!isMuted()) playTier(3); }; }
