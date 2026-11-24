import { setTable, TIERS } from './tiers.js';
export async function loadTable() {
  const res = await fetch(new URL('./data/paps-tier-table.json', import.meta.url));
  setTable(await res.json());
}
export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
  }
  for (const c of kids.flat()) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
const FILES = ['01-iron', '02-bronze', '03-silver', '04-gold', '05-platinum', '06-diamond', '07-master', '08-grandmaster', '09-challenger'];
export function badge(index, small = false) {
  return el('img', { class: `badge t${index}${small ? ' sm' : ''}`, src: new URL(`../assets/badges/${FILES[index]}.png`, import.meta.url).href, alt: TIERS[index] });
}
export function show(root, id) { document.body.dataset.view = id; root.querySelectorAll('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== id)); }
export function fmt(item, v) { return item === 'run50' ? v.toFixed(2) : String(v); }

// 브라우저 아래·위 막대를 뺀 '실제로 보이는 높이'를 재서 화면 높이로 쓴다 (사파리·웨일에서 100vh가 실제보다 큰 문제)
function setAppH() { document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`); }
setAppH(); window.addEventListener('resize', setAppH); window.addEventListener('orientationchange', () => setTimeout(setAppH, 200));
