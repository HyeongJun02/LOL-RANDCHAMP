/* jest 리졸버는 ESM 전용인 @neondatabase/neon-js를 파싱하지 못한다.
   테스트에는 REACT_APP_NEON_BASE_URL이 없어 클라이언트를 만들 일도 없으므로
   형태만 맞춘 껍데기로 갈음한다. 혹시 만들려 하면 던져서 neon.js가
   isNeonConfigured=false로 떨어지게 둔다 (실제 동작과 같은 경로). */
module.exports = {
  createClient: () => {
    throw new Error('테스트 환경에서는 Neon 클라이언트를 만들지 않습니다.');
  },
};
