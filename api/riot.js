/* Vercel 서버 함수. 몸통은 _riot.js (밑줄로 시작하는 파일은 주소가 안 생긴다) */
const { nodeHandler } = require('./_riot');

module.exports = nodeHandler;
