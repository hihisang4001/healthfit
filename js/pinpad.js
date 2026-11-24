// 비밀번호 칸을 누르면 숫자 키패드 창이 뜬다(학생 기록 입력 때처럼). 비밀번호는 숫자로만 만들고, 화면에는 ●로 가려 보여 준다.
// 사용: attachPinPad(input) — input은 form 안에 있어야 한다. 확인을 누르면 form이 제출된다.
const MAX = 12;
let dlg = null;
function build() {
  const m = document.createElement('div'); m.className = 'modal'; m.hidden = true; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', '비밀번호 입력');
  m.innerHTML = '<div class="dlg cell-dlg pin-dlg"><button type="button" class="dlg-x" data-pin="close">닫기</button><h2>비밀번호</h2>'
    + '<div class="disp"><input class="pin-val" readonly inputmode="none" autocomplete="off" aria-label="비밀번호 (숫자만, 가려서 표시)"></div>'
    + '<div class="pad pin-pad"></div></div>';
  const pad = m.querySelector('.pin-pad');
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'ok']) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.key = k;
    if (k === '⌫') { b.className = 'del'; b.textContent = '지우기'; b.setAttribute('aria-label', '지우기'); }
    else if (k === 'ok') { b.className = 'ok'; b.textContent = '확인'; }
    else b.textContent = k;
    pad.append(b);
  }
  document.body.append(m); return m;
}
// 오래된 사파리(requestSubmit 없음)에서도 바로 제출되게 한다
const submit = (f) => { if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); };
export function attachPinPad(input) {
  input.readOnly = true; input.setAttribute('inputmode', 'none'); input.type = 'password';
  let digits = '';
  const val = () => dlg.querySelector('.pin-val');
  const show = () => { val().value = '●'.repeat(digits.length); };
  const close = () => { dlg.hidden = true; document.removeEventListener('keydown', onKey, true); input.focus({ preventScroll: true }); };
  const confirm = () => { input.value = digits; close(); if (digits && input.form) submit(input.form); };
  const press = (k) => {
    if (k === '⌫') digits = digits.slice(0, -1);
    else if (k === 'ok') return confirm();
    else if (digits.length < MAX) digits += k;
    show();
  };
  function onKey(e) {
    if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('⌫'); else if (e.key === 'Enter') confirm(); else if (e.key === 'Escape') close(); else return;
    e.preventDefault(); e.stopPropagation();
  }
  const open = () => {
    if (!dlg) {
      dlg = build();
      dlg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.pin === 'close') close(); else if (b.dataset.key) press(b.dataset.key); });
    }
    digits = ''; show(); dlg.hidden = false; document.addEventListener('keydown', onKey, true);
  };
  input.addEventListener('click', open);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  return { reset() { input.value = ''; digits = ''; } };
}
