import React, { useState, useEffect, useRef } from 'react';
import { LINES } from './lines';
import styles from './Roulette.module.css';

const ITEM_WIDTH = 80; // 아이템 하나 너비(px)
const VISIBLE_COUNT = 3; // 화면에 보이는 아이템 개수
const CYCLES = 4; // 전체 회전 횟수 (옵션 길이의 몇 배를 굴릴지)

const Roulette = ({ options, selectedOption, trigger }) => {
  const [offset, setOffset] = useState(0);
  const prevTrigger = useRef(trigger);

  // spin 시작할 때마다 offset 초기화 → 애니메이션 적용
  useEffect(() => {
    if (trigger === prevTrigger.current) return;
    prevTrigger.current = trigger;
    if (selectedOption == null) return;

    // 최종 인덱스
    const finalIdx = options.findIndex((l) => l === selectedOption);
    if (finalIdx < 0) return;

    // 전체 아이템 배열: CYCLES번 반복 + 마지막 한 세트
    const totalItems = CYCLES * options.length + finalIdx;
    // 가운데 인덱스
    const mid = Math.floor(VISIBLE_COUNT / 2);
    // translateX 계산 (px 단위)
    const targetOffset = (mid - totalItems) * ITEM_WIDTH;

    // offset 0으로 리셋
    setOffset(0);
    // 다음 프레임에 애니메이션 트리거
    requestAnimationFrame(() => setOffset(targetOffset));
  }, [trigger, selectedOption, options]);

  // 렌더링할 아이템들
  const items = Array(CYCLES).fill(options).flat().concat(options);

  return (
    <div className={styles.viewport}>
      <div
        className={styles.list}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {items.map((name, i) => {
          const icon = LINES.find((l) => l.name === name)?.icon || '';
          return (
            <div key={`${name}-${i}`} className={styles.item}>
              <img src={icon} alt={name} />
              <span>{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Roulette;
