import React from 'react';
import { errorText } from '../../rules/riot';

/* 한 칸. 서버가 돌려준 { data } 또는 { error }.
   한 화면에 여러 API를 같이 부르는데, 키 권한이 없는 것(403) 하나 때문에
   나머지까지 안 보이면 안 된다. 실패한 칸만 이유를 적는다 */
const RiotPart = ({ part, empty = '없어요.', children }) => {
  if (!part) return null;
  if (part.error !== undefined) return <p className="riot-muted">{errorText(part.error)}</p>;
  const d = part.data;
  if (d == null || (Array.isArray(d) && d.length === 0)) return <p className="riot-muted">{empty}</p>;
  return children(d);
};

export default RiotPart;
