// 등급 계산 (순수 함수). 기준표는 setTable()로 주입한다 (브라우저: fetch, 테스트: 파일).
export const TIERS = ['아이언', '브론즈', '실버', '골드', '플래티넘', '다이아몬드', '마스터', '그랜드마스터', '챌린저'];
const LOWER_IS_BETTER = new Set(['run50']);
let table = null;
export function setTable(t) { table = t; }

export function gradeKey(grade, sex) {
  const g = Number(grade);
  if (!(g >= 3 && g <= 6) || (sex !== '남' && sex !== '여')) return null;
  return `초${g}${sex}`;
}

const round2 = (x) => Math.round(x * 100) / 100;

export function tierFor(item, key, value) {
  if (!key || !table) return null;
  const cut = table.cutoffs[item] && table.cutoffs[item][key];
  if (!cut) return null;
  const lower = LOWER_IS_BETTER.has(item);
  const meets = (tier) => (lower ? value <= cut[tier] : value >= cut[tier]);
  let index = 0; // 아이언
  for (let i = 1; i < TIERS.length; i++) if (meets(TIERS[i])) index = i;
  let next = null;
  if (index < TIERS.length - 1) {
    const nt = TIERS[index + 1];
    next = { tier: nt, needed: round2(lower ? value - cut[nt] : cut[nt] - value) };
  }
  return { tier: TIERS[index], index, next };
}

const better = (item, a, b) => (LOWER_IS_BETTER.has(item) ? a < b : a > b);
export function bestOfDay(records) {
  const map = new Map();
  for (const r of records) {
    const k = `${r.date}|${r.item}`;
    const cur = map.get(k);
    if (!cur || better(r.item, r.value, cur.value)) map.set(k, r);
  }
  return [...map.values()];
}

// 항목별 가장 최근 측정일의 최고 기록 (없으면 null)
export function latestBest(records, item) {
  const mine = bestOfDay(records.filter((r) => r.item === item)).sort((a, b) => b.date.localeCompare(a.date));
  return mine[0] || null;
}

// 입력값이 챌린저 기준의 1.5배를 넘으면(50M는 1/1.5보다 빠르면) 한 번 더 확인
export function isImplausible(item, key, value) {
  const cut = key && table && table.cutoffs[item] && table.cutoffs[item][key] && table.cutoffs[item][key]['챌린저'];
  if (!(cut > 0)) return false;
  return LOWER_IS_BETTER.has(item) ? value < cut / 1.5 : value > cut * 1.5;
}
