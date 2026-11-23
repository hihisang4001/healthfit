export function normalize(s) { return String(s ?? '').trim().toUpperCase(); }
// html5-qrcode(전역 Html5Qrcode)로 후면 카메라 스캔. 읽힌 값은 정규화해서 콜백에 전달.
export async function startScan(elementId, onId) {
  if (!window.Html5Qrcode) throw new Error('QR 라이브러리를 불러오지 못했어요.');
  const q = new window.Html5Qrcode(elementId);
  let done = false;
  await q.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, (text) => {
    if (done) return; const id = normalize(text); if (!id) return; done = true; onId(id);
  });
  return q;
}
