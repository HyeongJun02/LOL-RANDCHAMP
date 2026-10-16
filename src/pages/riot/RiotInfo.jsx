import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaSearch, FaTimes } from 'react-icons/fa';
import PageHeader from '../../components/common/PageHeader';
import { usePageMeta, PAGE_META } from '../../lib/seo';
import { parseRiotId, riotIdText } from '../../rules/riot';
import { loadChampions } from '../../server/riot';
import RiotHome from './RiotHome';
import RiotProfile from './RiotProfile';
import './RiotInfo.css';

/* 전적·정보. 라이엇 ID를 넣으면 그 사람, 안 넣으면 오늘의 정보(로테이션 ·
   서버 상태 · 랭킹).

   찾는 사람은 주소(?id=이름#태그)에 둔다. 뒤로 가기가 되고, 링크를 그대로
   보내줄 수 있다 */

const RECENT_KEY = 'lrc.riotRecent';
const RECENT_MAX = 6;

const loadRecent = () => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const saveRecent = (list) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* 못 남겨도 검색은 된다 */
  }
};

export default function RiotInfo() {
  usePageMeta(PAGE_META.riot);
  const [params, setParams] = useSearchParams();
  const raw = params.get('id') || '';
  const id = parseRiotId(raw);

  const [text, setText] = useState(raw);
  const [recent, setRecent] = useState(loadRecent);
  const [champs, setChamps] = useState(null);

  useEffect(() => {
    loadChampions().then(setChamps);
  }, []);

  /* 뒤로 가기로 주소가 바뀌면 입력칸도 따라간다 */
  useEffect(() => setText(raw), [raw]);

  const go = (riotId) => {
    setParams(riotId ? { id: riotId } : {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = (e) => {
    e.preventDefault();
    const p = parseRiotId(text);
    if (!p) {
      toast.error('이름#태그 모양으로 적어주세요. 예) Hide on bush#KR1');
      return;
    }
    go(riotIdText(p));
  };

  /* 실제로 찾은 이름(대소문자가 맞춰진 것)만 남긴다 */
  const remember = (found) =>
    setRecent((prev) => {
      const next = [found, ...prev.filter((x) => x.toLowerCase() !== found.toLowerCase())].slice(
        0,
        RECENT_MAX
      );
      saveRecent(next);
      return next;
    });

  const forget = (name) =>
    setRecent((prev) => {
      const next = prev.filter((x) => x !== name);
      saveRecent(next);
      return next;
    });

  return (
    <div className="page riot-page">
      <PageHeader
        title="전적 · 정보"
        sub="라이엇 ID로 롤 · TFT 전적을 보고, 오늘의 로테이션과 랭킹을 확인합니다."
      />

      <div className="riot-searchbox">
        <form className="riot-search" onSubmit={submit}>
          <FaSearch className="riot-search-icon" aria-hidden="true" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="이름#태그 (태그를 안 쓰면 #KR1)"
            aria-label="라이엇 ID"
            maxLength={24}
          />
          <button className="primary-btn" type="submit">
            검색
          </button>
        </form>
        {(recent.length > 0 || id) && (
          <div className="riot-recent">
            {id && (
              <button type="button" className="riot-chip is-home" onClick={() => go(null)}>
                오늘의 정보
              </button>
            )}
            {recent.map((r) => (
              <span key={r} className="riot-chip">
                <button type="button" onClick={() => go(r)}>
                  {r}
                </button>
                <button
                  type="button"
                  className="riot-chip-x"
                  onClick={() => forget(r)}
                  aria-label={`${r} 지우기`}
                >
                  <FaTimes />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {id ? (
        <RiotProfile key={riotIdText(id)} id={id} champs={champs} onFound={remember} onSearch={go} />
      ) : (
        <RiotHome champs={champs} onSearch={go} />
      )}

      {/* 라이엇 API를 쓰는 사이트는 이 문구를 달아야 한다 (라이엇 개발자 정책) */}
      <p className="riot-legal">
        롤랜챔은 Riot Games의 보증을 받지 않았으며, Riot Games 또는 리그 오브 레전드 · TFT ·
        발로란트 제작·관리에 공식적으로 관여하는 사람의 견해를 반영하지 않습니다. 리그 오브
        레전드와 Riot Games는 Riot Games, Inc.의 상표 또는 등록 상표입니다.
      </p>
    </div>
  );
}
