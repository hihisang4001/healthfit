// 인터넷이 없어도 앱 화면이 열리도록 앱 파일을 기기에 보관한다. 평소에는 항상 새 파일을 먼저 받아 오고(최신 유지),
// 인터넷이 끊겼을 때만 보관해 둔 파일을 쓴다. 서버(구글 시트) 요청은 건드리지 않는다.
const CACHE = 'hf-shell-v1';
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    try {
      const list = await (await fetch('precache.json', { cache: 'no-store' })).json();
      const c = await caches.open(CACHE);
      await Promise.all(list.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    } catch (x) { /* 목록이 없어도 설치는 계속 */ }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  const font = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (r.method !== 'GET' || (u.origin !== location.origin && !font) || u.pathname.endsWith('/version.json')) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(r);
      if (res.ok || res.type === 'opaque') { const c = await caches.open(CACHE); c.put(r, res.clone()).catch(() => {}); }
      return res;
    } catch (x) {
      const m = await caches.match(r, { ignoreSearch: true });
      if (m) return m;
      throw x;
    }
  })());
});
