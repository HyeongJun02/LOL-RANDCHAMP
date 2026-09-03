import { useEffect } from 'react';

/* 도메인은 여기 한 곳. public/index.html과 public/sitemap.xml,
   public/robots.txt의 URL도 같이 맞춰야 한다 */
export const SITE_URL = 'https://lol-randchamp.vercel.app/';

/* index.html에 이미 있는 태그를 갈아끼운다.
   새로 만들지 않으므로 description이 두 개가 되는 일이 없다 */
const swap = (selector, attr, value) => {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
};

/* SPA라 라우트가 바뀌어도 문서 제목은 그대로다. 페이지마다 직접 갈아준다 */
export const usePageMeta = ({ title, description, path }) => {
  useEffect(() => {
    const url = `${SITE_URL}${path}`;
    document.title = title;
    swap('meta[name="description"]', 'content', description);
    swap('meta[property="og:title"]', 'content', title);
    swap('meta[property="og:description"]', 'content', description);
    swap('meta[property="og:url"]', 'content', url);
    swap('link[rel="canonical"]', 'href', url);
  }, [title, description, path]);
};

/* 검색 결과에 그대로 나가는 문장들. UI 문구와 따로 관리한다 */
export const PAGE_META = {
  home: {
    path: '/',
    title: '롤랜챔 - 롤 내전 팀 짜기 · 랜덤 챔피언 뽑기 · 라인 분배',
    description:
      '롤 내전 팀 짜기, 랜덤 챔피언 뽑기, 라인 분배를 한 곳에서. 티어로 팀 밸런스를 맞추고 라인은 주사위로 정하세요. 설치도 로그인도 없이 바로 씁니다.',
  },
  teamBalance: {
    path: '/team-balance',
    title: '롤 내전 팀 짜기 - 티어로 밸런스 맞추기 | 롤랜챔',
    description:
      '롤 내전 팀 짜기 도구. 아이언부터 그랜드마스터까지 티어를 넣으면 양 팀 평점이 가장 비슷해지는 조합을 찾아줍니다. 10명을 다 안 채워도 되고, 완전 무작위로 돌릴 수도 있어요.',
  },
  randomChampion: {
    path: '/random-champion',
    title: '롤 랜덤 챔피언 뽑기 - 역할군·라인 필터 | 롤랜챔',
    description:
      '롤 랜덤 챔피언 뽑기. 암살자·전사·마법사 같은 역할군이나 탑·정글·미드·원딜·서폿 라인으로 거른 뒤 주사위를 굴리세요. 챔피언 정보는 최신 패치를 따라갑니다.',
  },
  randomLine: {
    path: '/random-line',
    title: '롤 라인 랜덤 분배 - 내전 라인 정하기 | 롤랜챔',
    description:
      '롤 내전 라인 분배 도구. 가기 싫은 라인은 미리 밴하고 나머지를 랜덤으로 배정합니다. 다섯 명 라인을 한 번에 정할 수 있어요.',
  },
  pick: {
    path: '/pick',
    title: '랜덤 뽑기 - 벌칙 정하기 · 동전 던지기 | 롤랜챔',
    description:
      '이름이나 항목을 넣고 하나 뽑는 랜덤 뽑기. 두 개만 넣으면 동전 던지기, 사람 이름을 넣으면 벌칙 당첨자나 픽 순서 정하기로 쓸 수 있습니다.',
  },
  season: {
    path: '/season',
    title: '내전 시즌 정산 - 월별 승률·순위 | 롤랜챔',
    description:
      '롤 내전 월별 정산. 9월, 10월처럼 달마다 끊어서 승패와 내전 포인트 순위를 냅니다. 매달 0에서 다시 시작합니다.',
  },
  scrimRecord: {
    path: '/scrim-record',
    title: '내전 기록지 - 롤 내전 전적 관리 | 롤랜챔',
    description:
      '롤 내전 결과 기록지. 칼바람/일반 내전을 구분해 승패를 남기고, 내전 포인트를 쌓아 내전 팀 짜기의 밸런스에 반영할 수 있습니다.',
  },
};
