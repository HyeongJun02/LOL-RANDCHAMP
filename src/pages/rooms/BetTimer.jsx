import React, { useEffect, useRef, useState } from 'react';

/* 배팅 마감까지 남은 시간.

   시각(betting_closes_at)은 서버가 정해서 내려준다. 각자 브라우저 시계로
   재면 시계가 몇 초 어긋난 사람들 사이에서 '누구는 됐고 누구는 안 되는'
   일이 생긴다. 그래도 카운트다운 자체는 브라우저 시계로 그리니, 몇 초
   차이는 있을 수 있다 - 그래서 미리 끝내라고 경고를 띄운다.

   0이 되면 onExpire를 한 번만 부른다. 실제 마감은 그걸 받은 쪽에서
   lock_betting을 불러 서버에 남긴다. */
const WARN_SECONDS = 20;

const mmss = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const BetTimer = ({ closesAt, openedAt, onExpire }) => {
  const end = new Date(closesAt).getTime();
  const start = new Date(openedAt || closesAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const left = Math.max(0, Math.ceil((end - now) / 1000));
  const total = Math.max(1, Math.round((end - start) / 1000));
  const ratio = Math.max(0, Math.min(1, left / total));

  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      onExpire?.();
    }
  }, [left, onExpire]);

  const warn = left > 0 && left <= WARN_SECONDS;

  return (
    <div className={`bet-timer ${warn ? 'is-warn' : ''} ${left === 0 ? 'is-done' : ''}`}>
      <div className="bet-timer-head">
        <span className="bet-timer-label">
          {left === 0 ? '마감 처리 중…' : '배팅 마감까지'}
        </span>
        {left > 0 && <strong className="bet-timer-left">{mmss(left)}</strong>}
      </div>
      <div className="bet-timer-bar">
        <span className="bet-timer-fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className="bet-timer-warn">
        시계가 사람마다 조금씩 다를 수 있어요. 마감 {WARN_SECONDS}초 전까지 배팅을 끝내주세요.
      </p>
    </div>
  );
};

export default BetTimer;
