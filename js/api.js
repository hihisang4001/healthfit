import { API_URL } from './config.js';
let url = API_URL;
export function setApiUrl(u) { url = u; }
let netHandler = () => {};
export function onNet(f) { netHandler = f; }   // 요청 성공/실패에 따라 인터넷 상태를 알려 준다
async function call(body) {
  let res;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 25000);
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body), signal: ctl.signal });
  } catch (e) {
    const err = new Error('인터넷 연결을 확인해 주세요.'); err.offline = true; netHandler(false); throw err;
  } finally { clearTimeout(timer); }
  netHandler(true);
  let data;
  try { data = await res.json(); } catch (e) { throw new Error('서버 응답을 읽을 수 없어요. 잠시 후 다시 시도해 주세요.'); }
  if (!data.ok) throw new Error(data.error || '문제가 생겼어요.');
  return data;
}
export const api = {
  ping: () => call({ action: 'ping' }),
  warm: () => { if (url) fetch(url).catch(() => {}); },
  studentMe: (id) => call({ action: 'student.me', id }),
  studentUndo: (id, recordId) => call({ action: 'student.undo', id, recordId }),
  studentAdd: (id, item, value, extra = {}) => call({ action: 'student.add', id, item, value, ...extra }),
  teacherList: (pin) => call({ action: 'teacher.list', pin }),
  teacherPromote: (pin) => call({ action: 'teacher.promote', pin, confirm: '학년올리기' }),
  teacherPromoteUndo: (pin) => call({ action: 'teacher.promoteUndo', pin }),
  teacherAdd: (pin, { id, date, item, value, left, right }) => call({ action: 'teacher.add', pin, id, date, item, value, left, right }),
  teacherUpdate: (pin, recordId, { value, date, left, right }) => call({ action: 'teacher.update', pin, recordId, value, date, left, right }),
  teacherDelete: (pin, recordId) => call({ action: 'teacher.delete', pin, recordId }),
};
