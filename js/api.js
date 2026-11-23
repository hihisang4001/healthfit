import { API_URL } from './config.js';
let url = API_URL;
export function setApiUrl(u) { url = u; }
async function call(body) {
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
  } catch (e) { throw new Error('인터넷 연결을 확인해 주세요.'); }
  let data;
  try { data = await res.json(); } catch (e) { throw new Error('서버 응답을 읽을 수 없어요. 잠시 후 다시 시도해 주세요.'); }
  if (!data.ok) throw new Error(data.error || '문제가 생겼어요.');
  return data;
}
export const api = {
  warm: () => { if (url) fetch(url).catch(() => {}); },
  studentMe: (id) => call({ action: 'student.me', id }),
  studentAdd: (id, item, value) => call({ action: 'student.add', id, item, value }),
  teacherList: (pin) => call({ action: 'teacher.list', pin }),
  teacherAdd: (pin, { id, date, item, value }) => call({ action: 'teacher.add', pin, id, date, item, value }),
  teacherUpdate: (pin, recordId, { value, date }) => call({ action: 'teacher.update', pin, recordId, value, date }),
  teacherDelete: (pin, recordId) => call({ action: 'teacher.delete', pin, recordId }),
};
