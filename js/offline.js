// 인터넷이 끊겨도 기록을 잃지 않도록 기기 안(localStorage)에 보관하는 저장소.
// queue: 아직 시트로 보내지 못한 기록 / failed: 서버가 거절한 기록 / cache: 학생 정보(오프라인 로그인용)
const QUEUE = 'hf-queue', FAILED = 'hf-failed', CACHE = 'hf-cache';

export function makeStore(storage) {
  const read = (k, d) => { try { const v = storage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const write = (k, v) => { try { storage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const slim = (r) => ({ recordId: r.recordId, date: r.date, id: r.id, item: r.item, value: r.value, grade: r.grade, by: r.by });
  return {
    queue: () => read(QUEUE, []),
    enqueue(item) { const q = read(QUEUE, []); q.push(item); return write(QUEUE, q); },
    removeQueued(cid) {
      const q = read(QUEUE, []), i = q.findIndex((x) => x.cid === cid);
      if (i < 0) return false;
      q.splice(i, 1); write(QUEUE, q); return true;
    },
    failed: () => read(FAILED, []),
    markFailed(item, reason) {
      const q = read(QUEUE, []).filter((x) => x.cid !== item.cid); write(QUEUE, q);
      const f = read(FAILED, []); f.push({ ...item, reason }); write(FAILED, f);
    },
    clearFailed() { write(FAILED, []); },
    cacheGet: (id) => (read(CACHE, {}))[id] || null,
    cachePut(id, d) {
      const c = read(CACHE, {});
      c[id] = { name: d.name, grade: d.grade, sex: d.sex, peers: d.peers || {}, records: (d.records || []).filter((r) => !r.pending).map(slim) };
      return write(CACHE, c);
    },
    cachePutMany(map) {
      const c = read(CACHE, {});
      for (const [id, d] of Object.entries(map)) c[id] = { name: d.name, grade: d.grade, sex: d.sex, peers: d.peers || (c[id] && c[id].peers) || {}, records: (d.records || []).map(slim) };
      return write(CACHE, c);
    },
    cacheAddRecord(id, rec) {
      const c = read(CACHE, {}); if (!c[id]) return;
      c[id].records = c[id].records.filter((r) => r.recordId !== rec.recordId); c[id].records.push(slim(rec)); write(CACHE, c);
    },
    cacheRemoveRecord(id, recordId) {
      const c = read(CACHE, {}); if (!c[id]) return;
      c[id].records = c[id].records.filter((r) => r.recordId !== recordId); write(CACHE, c);
    },
    cacheCount: () => Object.keys(read(CACHE, {})).length,
    // 아직 못 보낸 기록을 화면용 기록 형태로 바꿔 돌려준다
    pendingRecords(id, grade) {
      return read(QUEUE, []).filter((x) => x.id === id).map((x) => ({ id: x.id, item: x.item, value: Number(x.value), grade, date: x.date, by: '학생', pending: true, cid: x.cid }));
    },
  };
}
export const newCid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
