export function normalize(s) { return String(s ?? '').trim().toUpperCase(); }
// html5-qrcode(전역 Html5Qrcode)로 앞(전면) 카메라 스캔. 읽힌 값은 정규화해서 콜백에 전달.
// 빠르게: QR만 읽고(다른 코드 형식 검사 생략), 브라우저 내장 인식기(BarcodeDetector)가 있으면 사용.
// 카메라는 한 번 켜 두고 계속 쓴다. 읽히면 pause, 다음 학생이 올 때 resume (다시 켜는 1~2초를 아낌).
export async function startScan(elementId, onId) {
  if (!window.Html5Qrcode) throw new Error('QR 라이브러리를 불러오지 못했어요.');
  const q = new window.Html5Qrcode(elementId, {
    formatsToSupport: [window.Html5QrcodeSupportedFormats.QR_CODE],
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    verbose: false,
  });
  let busy = false;
  q.__ready = () => { busy = false; };
  await q.start({ facingMode: 'user' }, { fps: 15, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.8); return { width: s, height: s }; } }, (text) => {
    if (busy) return; const id = normalize(text); if (!id) return; busy = true; onId(id);
  }, () => {});
  return q;
}
