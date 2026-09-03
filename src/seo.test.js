import fs from 'fs';
import path from 'path';
import { PAGE_META, SITE_URL } from './seo';

const read = (rel) => fs.readFileSync(path.join(__dirname, rel), 'utf8');

/* 하드코딩하면 페이지를 추가할 때마다 이 테스트만 고치게 된다.
   실제 파일에서 읽어 비교해야 '라우트는 늘렸는데 SEO를 빼먹은' 걸 잡는다 */
/* :id 같은 동적 경로는 뺀다. 방마다 다른 페이지라 sitemap에 올릴 주소가 없고
   고정 제목·설명을 붙일 수도 없다 */
const routePaths = () =>
  [...read('App.js').matchAll(/<Route\s+path="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((p) => !p.includes(':'))
    .sort();

const sitemapPaths = () =>
  [...read('../public/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => new URL(m[1]).pathname)
    .map((p) => (p === '/' ? '/' : p.replace(/\/$/, '')))
    .sort();

const pages = Object.entries(PAGE_META);

test('모든 페이지에 제목과 설명이 있다', () => {
  expect(pages.length).toBeGreaterThan(0);
  pages.forEach(([key, m]) => {
    expect(m.title).toBeTruthy();
    expect(m.description).toBeTruthy();
    expect(m.path.startsWith('/')).toBe(true);
  });
});

/* 구글은 제목을 약 60자, 설명을 약 155자에서 자른다.
   한글은 폭이 넓어 더 일찍 잘리므로 여유를 두고 잡는다 */
test('제목과 설명이 검색 결과에서 잘리지 않을 길이다', () => {
  pages.forEach(([key, m]) => {
    expect(m.title.length).toBeLessThanOrEqual(45);
    expect(m.description.length).toBeLessThanOrEqual(110);
  });
});

test('페이지마다 제목이 서로 다르다 (중복 제목은 색인에서 손해)', () => {
  const titles = pages.map(([, m]) => m.title);
  expect(new Set(titles).size).toBe(titles.length);

  const descs = pages.map(([, m]) => m.description);
  expect(new Set(descs).size).toBe(descs.length);
});

test('모든 라우트에 제목·설명이 있다', () => {
  const metaPaths = pages.map(([, m]) => m.path).sort();
  expect(metaPaths).toEqual(routePaths());
});

test('모든 라우트가 sitemap에 들어 있다', () => {
  expect(sitemapPaths()).toEqual(routePaths());
});

test('노리는 검색어가 실제로 문구에 들어 있다', () => {
  const all = pages.map(([, m]) => m.title + m.description).join(' ');
  ['내전', '랜덤 챔피언', '라인', '뽑기', '팀 짜기'].forEach((kw) => {
    expect(all).toContain(kw);
  });
});

test('도메인이 아직 자리표시자면 알려준다', () => {
  // 배포 전에 SITE_URL / index.html / sitemap.xml / robots.txt를 같이 바꿔야 한다
  expect(SITE_URL.startsWith('https://')).toBe(true);
});
