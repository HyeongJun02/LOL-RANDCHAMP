import React, { useEffect, useMemo, useRef, useState } from 'react';

/* 세로 릴. 항목이 위로 흘러가다 가운데 칸에 당첨이 멈춘다.

   JS로 값을 빠르게 갈아끼우면 '깜빡임'으로 보인다. 실제 릴처럼 보이려면
   한 번의 긴 CSS 전환으로 감속하며 흘러야 한다. 그래서 돌리는 동안
   타이머를 쓰지 않고, 전환이 끝나는 시점만 알려준다. */
export const ROW = 46;
const VISIBLE = 3;
const MID = Math.floor(VISIBLE / 2);
const LOOPS = 8;
export const SPIN_MS = 2400;

const Reel = ({ pool, winner, seq, onDone }) => {
  const [landed, setLanded] = useState(0);
  const [animating, setAnimating] = useState(false);
  /* 도는 중에 항목이 바뀌어도 릴은 흔들리면 안 된다. 시작할 때 고정한다 */
  const frozen = useRef([]);

  const strip = useMemo(() => {
    if (!seq) return pool.slice(0, VISIBLE);
    return frozen.current;
  }, [seq, pool]);

  useEffect(() => {
    if (!seq || !winner) return undefined;

    const filler = Array.from({ length: LOOPS * Math.max(pool.length, 3) }, (_, i) =>
      pool.length ? pool[i % pool.length] : ''
    );
    /* 마지막 칸이 당첨. 그 앞은 아무 항목이나 흘러가면 된다 */
    frozen.current = [...filler, winner];
    const target = frozen.current.length - 1;

    setAnimating(false);
    setLanded(0);

    let inner;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setAnimating(true);
        setLanded(target);
      });
    });
    const stop = setTimeout(() => {
      setAnimating(false);
      onDone();
    }, SPIN_MS + 40);

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      clearTimeout(stop);
    };
    /* onDone은 매 렌더 새로 만들어지므로 의존성에서 뺀다 (넣으면 릴이 재시작된다) */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);

  return (
    <div className="reel" style={{ height: ROW * VISIBLE }}>
      <div
        className="reel-track"
        style={{
          transform: `translateY(${(MID - landed) * ROW}px)`,
          transition: animating
            ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.72, 0.09, 1)`
            : 'none',
        }}
      >
        {strip.map((item, i) => (
          <div
            className={`reel-item ${i === landed ? 'is-hit' : ''}`}
            style={{ height: ROW }}
            key={`${item}-${i}`}
          >
            {item}
          </div>
        ))}
      </div>
      <span className="reel-line" aria-hidden="true" />
    </div>
  );
};

export default Reel;
