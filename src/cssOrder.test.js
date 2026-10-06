const fs = require('fs');
const path = require('path');

/* index.js가 모든 CSS를 한 번에 싣는다 (이유는 index.js 주석).
   새 CSS를 만들고 거기 안 넣으면 그 페이지에 들어가기 전까지 규칙이 안 실린다 */
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.css') ? [p] : [];
  });

/* 어드민은 관리자만 들어가서 예전부터 따로 싣는다 */
const LAZY_OK = ['pages/admin/Admin.css'];

test('모든 CSS가 index.js에서 실린다', () => {
  const index = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  const missing = walk(__dirname)
    .map((p) => path.relative(__dirname, p).split(path.sep).join('/'))
    .filter((rel) => !LAZY_OK.includes(rel) && !index.includes(`import './${rel}';`));
  expect(missing).toEqual([]);
});
