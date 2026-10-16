/* 로컬 개발 서버(npm start)에서도 /api/riot이 돌게 한다. CRA가 알아서 읽는 파일이다.
   키는 .env.local의 RIOT_API_KEY (REACT_APP_가 없어서 화면 코드에는 안 실린다) */
const { nodeHandler } = require('../api/_riot');

module.exports = (app) => {
  app.get('/api/riot', nodeHandler);
};
