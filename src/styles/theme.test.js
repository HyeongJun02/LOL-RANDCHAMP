import fs from 'fs';
import path from 'path';

const theme = fs.readFileSync(path.join(__dirname, 'theme.css'), 'utf8');

/* 이 리셋이 없어서 모바일에 가로 스크롤이 생긴 적이 있다.
   원래 Global.css에 있었지만 그 파일은 어디서도 import되지 않아
   실제로는 적용된 적이 없었다. 다시 사라지면 여기서 걸린다. */
test('전역 border-box 리셋이 있다', () => {
  expect(theme).toMatch(/\*,\s*\*::before,\s*\*::after\s*\{[^}]*box-sizing:\s*border-box/);
});

test('theme.css가 실제로 앱에 물려 있다', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  expect(index).toContain('styles/theme.css');
});
