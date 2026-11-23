// 등급 효과음: 파일 없이 브라우저 안에서 만들어 내므로 오프라인에서도 소리가 난다.
// 등급이 높을수록 음이 많아지고 화려해진다.
const TIER_SOUNDS = [
  { w: 'triangle', step: 0.16, n: [-12, -17] },                                        // 아이언: 낮고 묵직한 두 음
  { w: 'triangle', step: 0.13, n: [0, 4] },                                            // 브론즈
  { w: 'sine', step: 0.12, n: [0, 4, 7] },                                             // 실버
  { w: 'triangle', step: 0.11, n: [0, 4, 7, 12] },                                     // 골드
  { w: 'sine', step: 0.1, n: [0, 4, 7, 12, 16], shine: true },                         // 플래티넘
  { w: 'sine', step: 0.09, n: [7, 12, 16, 19, 24], shine: true, bell: true },          // 다이아몬드
  { w: 'sawtooth', step: 0.1, n: [0, 7, 12, 16, 19], chord: [0, 4, 7, 12], shine: true }, // 마스터
  { w: 'sawtooth', step: 0.09, n: [0, 4, 7, 12, 16, 19, 24], chord: [0, 7, 12, 16], shine: true }, // 그랜드마스터
  { w: 'square', step: 0.085, n: [0, 4, 7, 12, 7, 12, 16, 19, 24, 28], chord: [0, 7, 12, 16, 19], shine: true, bell: true }, // 챌린저
];
let ctx = null, muted = false;
try { muted = localStorage.getItem('hf-mute') === '1'; } catch (e) {}
export const isMuted = () => muted;
export function setMuted(m) { muted = !!m; try { localStorage.setItem('hf-mute', m ? '1' : '0'); } catch (e) {} }
function ac() {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ctx = new C(); } catch (e) { return null; } }
  return ctx;
}
// 아이패드는 화면을 한 번 눌러야 소리를 낼 수 있어서, 첫 터치 때 미리 깨워 둔다.
export function unlock() { const c = ac(); if (c && c.state === 'suspended') c.resume().catch(() => {}); }
function tone(c, t, hz, dur, type, vol) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(hz, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
}
export function playTier(index) {
  if (muted) return;
  const c = ac(), s = TIER_SOUNDS[index]; if (!c || !s) return;
  try {
    if (c.state === 'suspended') c.resume().catch(() => {});
    const hz = (semi) => 523.25 * Math.pow(2, semi / 12), t0 = c.currentTime + 0.05;
    s.n.forEach((semi, i) => {
      const t = t0 + i * s.step;
      tone(c, t, hz(semi), 0.35, s.w, s.w === 'sine' || s.w === 'triangle' ? 0.22 : 0.09);
      if (s.bell) tone(c, t, hz(semi) * 2.01, 0.5, 'sine', 0.06);
    });
    const end = t0 + s.n.length * s.step;
    if (s.chord) s.chord.forEach((semi) => tone(c, end, hz(semi), 0.9, s.w, 0.06));
    if (s.shine) [0, 0.07, 0.14].forEach((d, i) => tone(c, end + d, hz(28 + i * 4), 0.4, 'sine', 0.07));
  } catch (e) { /* 소리가 안 나도 기록에는 영향 없음 */ }
}
