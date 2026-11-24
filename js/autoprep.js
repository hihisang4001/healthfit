// 오프라인 명단: 교사가 교사용 화면에서 명단을 받아 올 때마다(로그인, 새로고침, 기록 고치기 뒤) 이 태블릿에 자동 저장한다.
// 인터넷이 끊기면 학생 화면이 이 저장본으로 동작한다. 교사용 비밀번호는 저장하지 않는다.
const PREP = 'hf-prep-at';

export function prepMap(roster, records) {
  const map = {};
  for (const s of roster) map[s.id] = { name: s.name, grade: s.grade, sex: s.sex, records: records.filter((r) => r.id === s.id) };
  return map;
}
export const lastPrepAt = (storage) => { try { return Number(storage.getItem(PREP)) || 0; } catch (e) { return 0; } };
export function markPrep(storage, at = Date.now()) { try { storage.setItem(PREP, String(at)); } catch (e) {} }
// v23~v25에서 저장했던 자동 갱신 비밀번호를 지운다
export function clearAuto(storage) { try { storage.removeItem('hf-auto'); } catch (e) {} }
export function prepLabel(storage) {
  const t = lastPrepAt(storage); if (!t) return '아직 명단을 저장하지 않았어요.';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return `${p.month}월 ${p.day}일 ${Number(p.hour)}시 ${Number(p.minute)}분에 명단을 마지막으로 저장했어요.`;
}
// 받아 온 명단을 저장하고 저장 시각을 남긴다. 성공하면 true
export function savePrep(store, storage, roster, records, now = Date.now()) {
  try { if (!store.cachePutMany(prepMap(roster, records))) return false; markPrep(storage, now); return true; } catch (e) { return false; }
}
