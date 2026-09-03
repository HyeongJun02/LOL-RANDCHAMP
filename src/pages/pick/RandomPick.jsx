import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FaPlus, FaTimes, FaDice, FaRedo } from 'react-icons/fa';
import { useRoster } from '../../roster';
import { addItems, poolOf } from './pick';
import { ROLL_MS, rollDelay } from '../../rollTiming';
import RosterLoader from '../../components/common/RosterLoader';
import RosterLoadButton from '../../components/common/RosterLoadButton';
import PageHeader from '../../components/common/PageHeader';
import { usePageMeta, PAGE_META } from '../../seo';
import './RandomPick.css';

const PRESETS = [
  { label: '동전', items: ['앞', '뒤'] },
  { label: '가위바위보', items: ['가위', '바위', '보'] },
  { label: '예 / 아니오', items: ['예', '아니오'] },
];

const RandomPick = () => {
  const roster = useRoster();
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState('');
  const [drawn, setDrawn] = useState([]);
  const [exclude, setExclude] = useState(false);
  const [rolling, setRolling] = useState(null);
  const [result, setResult] = useState(null);
  const timer = useRef(null);
  const [showLoader, setShowLoader] = useState(false);
  usePageMeta(PAGE_META.pick);

  useEffect(() => () => clearTimeout(timer.current), []);

  const pool = poolOf(items, drawn, exclude);

  const add = () => {
    const next = addItems(items, draft);
    if (next.length === items.length) {
      toast.error('추가할 항목이 없어요.');
      return;
    }
    setItems(next);
    setDraft('');
  };

  /* 다른 탭과 같은 규칙: 체크한 사람만 남기고, 직접 입력한 항목은 건드리지 않는다 */
  const syncFromRoster = (members) => {
    const rosterNames = new Set(roster.map((m) => m.name.trim()));
    const typed = items.filter((it) => !rosterNames.has(it));
    const picked = members.map((m) => m.name.trim()).filter(Boolean);
    setItems([...new Set([...typed, ...picked])]);
  };

  const clearAll = () => {
    setItems([]);
    setDrawn([]);
    setResult(null);
  };

  const draw = () => {
    if (timer.current) return;
    if (pool.length === 0) {
      toast.error(items.length === 0 ? '항목을 먼저 넣어주세요.' : '남은 항목이 없어요.');
      return;
    }

    setResult(null);
    const pick = () => pool[Math.floor(Math.random() * pool.length)];
    const startedAt = Date.now();

    /* 챔피언 뽑기와 같은 연출. 끝으로 갈수록 느려져야 뽑는 맛이 난다 */
    const step = () => {
      const progress = (Date.now() - startedAt) / ROLL_MS;
      if (progress >= 1) {
        timer.current = null;
        const final = pick();
        setRolling(null);
        setResult(final);
        setDrawn((prev) => [...prev, final]);
        return;
      }
      setRolling(pick());
      timer.current = setTimeout(step, rollDelay(progress));
    };

    timer.current = setTimeout(step, 0);
  };

  const shown = rolling || result;

  return (
    <div className="page pick-page">
      <PageHeader
        title="랜덤 뽑기"
        sub="항목을 넣고 하나 뽑습니다. 2개만 넣으면 동전 던지기, 이름을 넣으면 벌칙 당첨자."
      />

      <div className="pick-layout">
        <section className="pick-panel">
          <div className="pick-input">
            <input
              value={draft}
              placeholder="항목 입력 (쉼표나 줄바꿈으로 여러 개)"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <button className="pick-add" onClick={add}>
              <FaPlus /> 추가
            </button>
          </div>

          <div className="pick-presets">
            <RosterLoadButton
              onClick={() => setShowLoader(true)}
              disabled={roster.length === 0}
            />
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="ghost-btn"
                onClick={() => {
                  setItems(p.items);
                  setDrawn([]);
                  setResult(null);
                }}
              >
                {p.label}
              </button>
            ))}
            {items.length > 0 && (
              <button className="ghost-btn danger" onClick={clearAll}>
                전체 비우기
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="pick-blank">
              위에 항목을 넣거나, 저장된 팀원 명단을 통째로 불러오세요.
            </p>
          ) : (
            <ul className="pick-items">
              {items.map((it) => {
                const used = exclude && drawn.includes(it);
                return (
                  <li key={it} className={used ? 'is-used' : ''}>
                    {it}
                    <button
                      onClick={() => setItems((prev) => prev.filter((x) => x !== it))}
                      aria-label={`${it} 삭제`}
                    >
                      <FaTimes />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="pick-side">
          <div className={`pick-stage ${rolling ? 'is-rolling' : ''}`}>
            {shown ? (
              <>
                <span className="pick-result">{shown}</span>
                {result && !rolling && (
                  <span key={`flash-${result}`} className="result-flash" aria-hidden="true" />
                )}
              </>
            ) : (
              <span className="pick-idle">
                <FaDice />
              </span>
            )}
          </div>

          <button className="draw-btn" onClick={draw} disabled={!!rolling}>
            {result && !rolling ? <FaRedo /> : <FaDice className="draw-dice" />}
            {rolling ? '뽑는 중...' : result ? '다시 뽑기' : '뽑기'}
            <span className="draw-pool">{pool.length}개 중</span>
          </button>

          <label className="pick-toggle">
            <input
              type="checkbox"
              checked={exclude}
              onChange={(e) => setExclude(e.target.checked)}
            />
            뽑은 항목 제외
            <span>순서 정하기나 여러 명 뽑을 때</span>
          </label>

          {drawn.length > 0 && (
            <div className="pick-history">
              <p>
                뽑은 순서
                <button onClick={() => setDrawn([])}>비우기</button>
              </p>
              <ol>
                {drawn.map((d, i) => (
                  <li key={`${d}-${i}`}>{d}</li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>

      {showLoader && (
        <RosterLoader
          present={items}
          onConfirm={syncFromRoster}
          onClose={() => setShowLoader(false)}
        />
      )}
    </div>
  );
};

export default RandomPick;
