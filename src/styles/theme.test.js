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

/* 규칙 하나를 지우면서 쉼표 목록이 끊기면, 남은 선택자가 바로 아래
   엉뚱한 규칙에 묶여 버린다. 실제로 세그 탭 안의 로고가 '새로고침
   버튼'의 여백을 물려받아 혼자 내려가 있었다. 화면만 봐서는 한참 못 찾고,
   CSS는 틀려도 오류를 안 내니 여기서 잡는다 */
test('선택자 목록이 쉼표로 끝난 채 끊긴 곳이 없다', () => {
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return walk(full);
      return e.name.endsWith('.css') ? [full] : [];
    });

  const bad = [];
  walk(path.join(__dirname, '..')).forEach((file) => {
    const lines = fs
      .readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n');

    lines.forEach((line, i) => {
      if (!line.trim().endsWith(',')) return;
      const next = (lines[i + 1] || '').trim();
      /* 쉼표 다음에 선택자가 와야 한다. 빈 줄이나 '{'가 오면 끊긴 것이다 */
      if (next === '' || next.startsWith('{')) {
        bad.push(`${path.relative(path.join(__dirname, '..'), file)}:${i + 1} ${line.trim()}`);
      }
    });
  });

  expect(bad).toEqual([]);
});
