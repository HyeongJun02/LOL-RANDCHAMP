import { PAGE_META, SITE_URL } from './seo';

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

test('경로가 App.js 라우트와 일치한다', () => {
  const paths = pages.map(([, m]) => m.path).sort();
  expect(paths).toEqual([
    '/',
    '/pick',
    '/random-champion',
    '/random-line',
    '/scrim-record',
    '/team-balance',
  ]);
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
