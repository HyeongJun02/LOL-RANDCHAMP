import { createClient } from '@neondatabase/neon-js';

/* Neon 콘솔 > 프로젝트 > Data API 탭에서 Base URL을 복사해 .env.local에 넣는다.
   REACT_APP_NEON_BASE_URL=https://ep-xxx.c-2.us-east-2.aws.neon.build/dbname
   이 문자열 하나로 로그인용 Auth URL과 Data API URL이 둘 다 자동으로 유도된다. */
const baseUrl = process.env.REACT_APP_NEON_BASE_URL;

/* 값이 비어 있을 때뿐 아니라, 형식이 이상해서 createClient가 던지는 경우도
   여기서 한 번에 막는다 (예: 호스트에 점이 3개 안 된다거나 쿼리스트링이 붙은 경우).
   안 막으면 이 모듈을 물고 있는 App 전체가 하얀 화면이 된다 */
let client = null;
if (baseUrl) {
  try {
    client = createClient(baseUrl);
  } catch (err) {
    console.error('[neon] REACT_APP_NEON_BASE_URL이 올바르지 않아요:', err.message);
  }
}

export const neon = client;
export const isNeonConfigured = client !== null;
