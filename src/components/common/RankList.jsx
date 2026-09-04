import React from 'react';
import './RankList.css';

/* 순위 목록.

   전적 리더보드·시즌 순위·끼꼬 순위가 각각 다른 모양으로 굴러가고 있었다.
   같은 '줄 세우기'인데 화면마다 생김새가 달라서, 방을 옮겨 다니면 매번
   눈이 다시 적응해야 했다. 한 가지 말로 통일한다.

   숫자만 오른쪽에 몰아두면 1등과 5등이 얼마나 차이 나는지 안 읽힌다.
   줄 밑에 얇은 막대를 깔아 크기를 눈으로 보게 한다. */

const RankList = ({ rows = [], empty = '아직 기록이 없어요.' }) => {
  if (rows.length === 0) return <p className="rank-blank">{empty}</p>;

  return (
    <ol className="rank-list">
      {rows.map((r, i) => (
        <li key={r.key ?? r.name} className={`rank-row ${i < 3 ? `is-top is-top-${i + 1}` : ''}`}>
          <span className="rank-no">{i + 1}</span>

          <span className="rank-main">
            <span className="rank-name">
              {r.name}
              {r.me && <em> (나)</em>}
            </span>
            {r.badge}
          </span>

          {r.stat && <span className="rank-stat">{r.stat}</span>}
          {r.value && <span className="rank-value">{r.value}</span>}

          {/* 0으로 두면 막대가 아예 안 보여서 줄이 비어 보인다 */}
          <span
            className="rank-bar"
            style={{ '--fill': `${Math.max(2, Math.round((r.ratio || 0) * 100))}%` }}
          />
        </li>
      ))}
    </ol>
  );
};

export default RankList;
