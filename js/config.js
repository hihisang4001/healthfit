export const API_URL = 'https://script.google.com/macros/s/AKfycbz4s4AUl4U5BTYN8NkT3yUuqL0SoY6SF57L7szcMwpwb_nYLcpFCZBx__6J3zAhh3Y/exec'; // SETUP.md 참고: Apps Script 웹앱 주소
export const DEV = false;  // true면 ?id=24-001 로 카메라 없이 로그인
export const ITEMS = [
  { key: 'shuttle_run', label: '왕복오래달리기', unit: '회', min: 0, max: 300, step: 1 },
  { key: 'curl_up', label: '윗몸말아올리기', unit: '회', min: 0, max: 200, step: 1 },
  { key: 'standing_jump', label: '제자리멀리뛰기', unit: 'cm', min: 0, max: 300, step: 1 },
  { key: 'sit_reach', label: '앉아윗몸앞으로굽히기', unit: 'cm', min: -30, max: 50, step: 0.1 },
  { key: 'run50', label: '50M 달리기', unit: '초', min: 5, max: 30, step: 0.01 },
];
