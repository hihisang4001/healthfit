// 학년별 색: QR 카드와 교사용 화면이 같은 색을 쓴다
export const GRADE_COLORS = { 1: '#D2412E', 2: '#E8742A', 3: '#E0A800', 4: '#22874E', 5: '#2D6CC8', 6: '#7B4FC2' };
export const gradeColor = (g) => GRADE_COLORS[Number(g)] || '#5A6660';
export const gradeInk = (g) => (Number(g) === 3 ? '#2A2000' : '#fff');   // 노란색(3학년) 위에는 진한 글씨
