// 오프라인 준비 자동 갱신: 교사가 한 번 켜 두면, 이 태블릿이 인터넷이 될 때 6시간마다 전체 명단·기록을 조용히 새로 받아 저장한다.
// 켜면 교사용 비밀번호가 이 태블릿(브라우저)에 저장된다. 끄면 지워진다.
import { api } from './api.js';
const AUTO = 'hf-auto', PREP = 'hf-prep-at', EVERY = 6 * 3600 * 1000;
let busy = false;

export function prepMap(roster, records) {
  const map = {};
  for (const s of roster) map[s.id] = { name: s.name, grade: s.grade, sex: s.sex, records: records.filter((r) => r.id === s.id) };
  return map;
}
export const lastPrepAt = (storage) => { try { return Number(storage.getItem(PREP)) || 0; } catch (e) { return 0; } };
export function markPrep(storage, at = Date.now()) { try { storage.setItem(PREP, String(at)); } catch (e) {} }
export function autoOn(storage) { try { return !!JSON.parse(storage.getItem(AUTO) || 'null'); } catch (e) { return false; } }
export function setAuto(storage, pin) { try { storage.setItem(AUTO, JSON.stringify({ pin })); return true; } catch (e) { return false; } }
export function clearAuto(storage) { try { storage.removeItem(AUTO); } catch (e) {} }
export function prepLabel(storage) {
  const t = lastPrepAt(storage); if (!t) return '아직 저장한 적이 없어요';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return `${p.month}월 ${p.day}일 ${p.hour}:${p.minute}에 마지막으로 저장했어요`;
}
// 결과: 'off'(꺼짐) | 'fresh'(최근에 받음) | 'busy' | 'offline'(나중에 다시) | 'badpin'(비밀번호가 바뀜: 자동 갱신 끔) | 'ok'
export async function autoRefresh(store, storage, { force = false, now = Date.now(), fetchList = (pin) => api.teacherList(pin) } = {}) {
  let a = null; try { a = JSON.parse(storage.getItem(AUTO) || 'null'); } catch (e) {}
  if (!a || !a.pin) return 'off';
  if (!force && now - lastPrepAt(storage) < EVERY) return 'fresh';
  if (busy) return 'busy';
  busy = true;
  try {
    const d = await fetchList(a.pin);
    if (!store.cachePutMany(prepMap(d.roster || [], d.records || []))) return 'offline';
    markPrep(storage, now); return 'ok';
  } catch (e) {
    if (e && e.offline) return 'offline';
    clearAuto(storage); return 'badpin';
  } finally { busy = false; }
}
