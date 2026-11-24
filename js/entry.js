// 기록 입력 규칙(학생 화면·교사용 칸 입력이 같이 쓴다): 숫자 키패드 글자 만들기와 값 읽기.
// 오래달리기-걷기(mmss)는 '분:초'로 입력하고, 저장·계산은 초 단위 정수로 한다.
export const LOWER = new Set(['run50', 'long_run']);          // 낮을수록 좋은 기록
export const unitOf = (it) => it.unit || (it.mmss ? '분:초' : '');
export const decimalsOf = (it) => { const m = String(it.step).split('.')[1]; return m ? m.length : 0; };
export const keyLabel = (it, k) => (k === '⌫' ? '지우기' : k === '.' ? (it && it.mmss ? ':' : '.') : k);
export const dotEnabled = (it) => !!(it.mmss || decimalsOf(it));
// 현재 글자 t에 키 k를 눌렀을 때 새 글자
export function pressKey(it, t, k) {
  if (k === '⌫') return t.slice(0, -1);
  if (it.mmss) {
    if (k === '.') return t !== '' && !t.includes(':') ? t + ':' : t;
    const [m, s] = t.split(':');
    if (s !== undefined ? s.length >= 2 : m.length >= 3) return t;
    return t + k;
  }
  const dec = decimalsOf(it);
  if (k === '.') return dec && t !== '' && t !== '-' && !t.includes('.') ? t + '.' : t;
  const frac = t.split('.')[1];
  if (t.replace('-', '').replace('.', '').length >= 6) return t;
  if (frac !== undefined && frac.length >= dec) return t;
  return (t === '0' ? '' : t === '-0' ? '-' : t) + k;
}
// 입력 글자 → { n: 계산용 숫자, send: 서버에 보낼 글자 } 또는 { error }
export function parseEntry(it, raw) {
  const t = String(raw).trim().replace(',', '.');
  if (it.mmss) {
    const m = /^(\d+):(\d{1,2})$/.exec(t);
    if (!m) return { error: '분과 초를 눌러 입력해 주세요. 예: 5분 30초는 5 : 3 0' };
    if (Number(m[2]) > 59) return { error: '초는 59까지만 입력할 수 있어요.' };
    const n = Number(m[1]) * 60 + Number(m[2]);
    if (n < it.min || n > it.max) return { error: `${Math.floor(it.min / 60)}분부터 ${Math.floor(it.max / 60)}분 사이로 입력해 주세요.` };
    return { n, send: String(n) };
  }
  if (t === '' || !/^-?\d+(\.\d+)?$/.test(t)) return { error: '숫자를 눌러 입력해 주세요.' };
  const n = Number(t);
  if (n < it.min || n > it.max) return { error: `${it.min}부터 ${it.max} 사이의 숫자를 입력해 주세요.` };
  return { n, send: t };
}
// 기록값 → 입력칸에 넣을 글자 (고치기용)
export const entryText = (it, v) => (it.mmss ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` : String(v));
// 기록값 → 화면에 보여 줄 글자 (단위는 따로 붙인다)
export function fmtValue(key, v) {
  if (key === 'run50') return v.toFixed(2);
  if (key === 'long_run') return `${Math.floor(v / 60)}분 ${String(v % 60).padStart(2, '0')}초`;
  if (key === 'grip') return v.toFixed(1);
  return String(v);
}
// 다음 등급까지 남은 양
export const needText = (it, n) => (it.mmss ? `${n}초` : `${n}${it.unit}`);
