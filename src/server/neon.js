import { createClient } from '@neondatabase/neon-js';

/* 이 프로젝트의 Neon Data API Base URL.
   (Neon 콘솔 > Data API 탭의 주소에서 `.apirest`와 `/rest/v1`을 뺀 형태)

   비밀값이 아니라서 코드에 그냥 둔다. REACT_APP_* 는 어차피 빌드 때 번들에
   문자열로 박혀 모든 방문자에게 그대로 노출된다. 감춰서 지키는 값이 아니라
   Neon Auth 로그인과 RLS 정책으로 지키는 구조다(sql/setup.sql 참고).

   기본값을 둬서 배포 환경에 환경변수를 안 넣어도 동작하게 한다. 실제로
   Vercel에 값이 없어 로그인 버튼 자체가 안 뜨는 일이 있었다.
   다른 Neon 프로젝트를 쓰려면 .env.local의 REACT_APP_NEON_BASE_URL로 덮으면 된다. */
const DEFAULT_BASE_URL =
  'https://ep-soft-math-av67dj78.c-11.us-east-1.aws.neon.tech/neondb';

const baseUrl = process.env.REACT_APP_NEON_BASE_URL || DEFAULT_BASE_URL;

/* 값이 비어 있을 때뿐 아니라, 형식이 이상해서 createClient가 던지는 경우도
   여기서 한 번에 막는다 (예: 호스트에 점이 3개 안 된다거나 쿼리스트링이 붙은 경우).
   안 막으면 이 모듈을 물고 있는 App 전체가 하얀 화면이 된다 */
let client = null;
if (baseUrl) {
  try {
    client = createClient(baseUrl);
  } catch (err) {
    console.error('[neon] Base URL이 올바르지 않아요:', err.message);
  }
}

export const neon = client;
export const isNeonConfigured = client !== null;
