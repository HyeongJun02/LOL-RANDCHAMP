/* Netlify 서버 함수. 몸통은 api/_riot.js - Vercel과 같은 것을 쓴다.
   /api/riot 주소는 public/_redirects가 여기로 돌린다 */
const { run } = require('../../api/_riot');

exports.handler = async (event) => {
  const out = await run(event.queryStringParameters || {}, process.env.RIOT_API_KEY);
  return { statusCode: out.status, headers: out.headers, body: JSON.stringify(out.body) };
};
