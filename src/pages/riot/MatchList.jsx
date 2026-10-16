import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaChevronDown, FaSearchPlus } from 'react-icons/fa';
import { riotGet } from '../../server/riot';
import { queueName, clock, kdaRatio, errorText, MATCH_TABS, kilo } from '../../rules/riot';
import { timeAgo } from '../../lib/timeAgo';
import { Champ, Items, Lane } from './RiotBits';

/* 롤 최근 매치. 위에서 큐(전체 · 솔로 · 자유 · 일반 · 칼바람)를 고르면 그
   큐의 판만 라이엇이 걸러 준다. 20판씩, '더 보기'로 이어 받는다.

   판 상세는 한 판씩 따로 받는다 - 끝난 판은 안 바뀌어서 서버가 하루 캐시하고,
   화면도 한 번 받은 판은 다시 안 부른다 (server/riot.js).
   큐를 바꿨다 돌아와도 받아둔 목록은 그대로 둔다 */

/* 아직 안 받은 큐의 목록. 렌더마다 새 []를 만들면 아래 effect들이 매번 돈다 */
const EMPTY = [];

/* 펼치면 두 팀만. 더 자세한 건 '게임 상세' 탭이 맡는다 */
const Teams = ({ m, me, champs, onSearch }) => (
  <div className="riot-detail">
    {[100, 200].map((team) => {
      const t = m.teams.find((x) => x.id === team) || {};
      return (
        <div key={team} className={`riot-team ${team === 100 ? 'is-blue' : 'is-red'}`}>
          <div className="riot-team-head">
            <strong>
              {team === 100 ? '블루팀' : '레드팀'} {t.win ? '승리' : '패배'}
            </strong>
            <span>
              킬 {t.kills} · 용 {t.dragon} · 바론 {t.baron} · 포탑 {t.tower}
            </span>
          </div>
          <ul>
            {m.players
              .filter((p) => p.team === team)
              .map((p) => (
                <li key={p.puuid} className={p.puuid === me ? 'is-me' : ''}>
                  <Lane pos={p.pos} iconOnly />
                  <Champ champs={champs} name={p.champ} size="sm" />
                  <button
                    type="button"
                    className="riot-link"
                    onClick={() => p.name && onSearch(`${p.name}#${p.tag}`)}
                  >
                    {p.name || '?'}
                  </button>
                  <span className="riot-detail-kda">
                    {p.k}/{p.d}/{p.a}
                  </span>
                  <span className="riot-detail-num">{kilo(p.dmg)}</span>
                  <span className="riot-detail-num">{p.cs} CS</span>
                  <Items items={p.items} version={champs?.version} small />
                </li>
              ))}
          </ul>
        </div>
      );
    })}
  </div>
);

const MatchRow = ({ m, me, champs, onSearch, onDetail }) => {
  const [open, setOpen] = useState(false);
  const p = m.players.find((x) => x.puuid === me);
  if (!p) return null;
  const minutes = m.duration / 60 || 1;
  // 5분 안에 끝난 판은 다시하기(리메이크)
  const remake = m.duration < 300;
  const result = remake ? 'is-remake' : p.win ? 'is-win' : 'is-lose';

  return (
    <li className={`riot-match ${result}`}>
      <button
        type="button"
        className="riot-match-row"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="riot-match-result">
          <strong>{remake ? '다시하기' : p.win ? '승리' : '패배'}</strong>
          <em>{queueName(m.queue, m.mode)}</em>
          <em>
            {m.end ? timeAgo(m.end) : ''} · {clock(m.duration)}
          </em>
        </span>
        <Champ champs={champs} name={p.champ} level={p.level} />
        <span className="riot-match-kda">
          <strong>
            {p.k} / <i>{p.d}</i> / {p.a}
          </strong>
          <em>
            {kdaRatio(p.k, p.d, p.a)} KDA
            <Lane pos={p.pos} />
          </em>
        </span>
        <span className="riot-match-stat">
          <em>
            CS {p.cs} ({(p.cs / minutes).toFixed(1)})
          </em>
          <em>피해 {p.dmg.toLocaleString()}</em>
          {p.multi >= 3 && <b>{['', '', '', '트리플킬', '쿼드라킬', '펜타킬'][p.multi]}</b>}
        </span>
        <Items items={p.items} version={champs?.version} />
        <FaChevronDown className={`riot-chev ${open ? 'is-open' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <>
          <Teams m={m} me={me} champs={champs} onSearch={onSearch} />
          <div className="riot-match-foot">
            <button type="button" className="ghost-btn" onClick={() => onDetail(m.id)}>
              <FaSearchPlus /> 게임 상세 보기
            </button>
          </div>
        </>
      )}
    </li>
  );
};

const MatchList = ({ puuid, me, champs, onSearch, onDetail, onLoaded, fresh = false }) => {
  const [tab, setTab] = useState('all');
  /* 큐마다 { ids, more, busy, error } */
  const [lists, setLists] = useState({});
  const [matches, setMatches] = useState({});
  const asked = useRef(new Set());

  const loadPage = useCallback(
    async (filter, start) => {
      setLists((prev) => ({
        ...prev,
        [filter]: { ids: [], ...prev[filter], busy: true, error: undefined },
      }));
      const r = await riotGet(
        { fn: 'matchIds', puuid, filter, start: String(start) },
        { fresh: fresh && start === 0 }
      );
      setLists((prev) => {
        const cur = prev[filter] || { ids: [] };
        if (r.error !== undefined) return { ...prev, [filter]: { ...cur, busy: false, error: r.error } };
        const got = r.data.ids || [];
        const ids = start === 0 ? got : [...cur.ids, ...got.filter((x) => !cur.ids.includes(x))];
        return { ...prev, [filter]: { ids, more: Boolean(r.data.more), busy: false } };
      });
    },
    [puuid, fresh]
  );

  useEffect(() => {
    if (!lists[tab]) loadPage(tab, 0);
  }, [tab, lists, loadPage]);

  const fetchMatch = useCallback((id) => {
    asked.current.add(id);
    riotGet({ fn: 'match', id }).then((r) => setMatches((prev) => ({ ...prev, [id]: r })));
  }, []);

  const ids = lists[tab]?.ids || EMPTY;
  useEffect(() => {
    ids.filter((id) => !asked.current.has(id)).forEach(fetchMatch);
  }, [ids, fetchMatch]);

  /* 게임 상세 탭이 '이전 판 · 다음 판'을 넘길 수 있게 지금 목록을 알려준다 */
  useEffect(() => {
    onLoaded?.(ids);
  }, [ids, onLoaded]);

  const list = lists[tab];
  const mine = ids
    .map((id) => matches[id]?.data)
    .filter(Boolean)
    .map((m) => ({ m, p: m.players.find((x) => x.puuid === me) }))
    .filter((x) => x.p && x.m.duration >= 300);
  const wins = mine.filter((x) => x.p.win).length;
  const sum = (f) => mine.reduce((s, x) => s + x.p[f], 0);

  return (
    <div className="riot-matches">
      <div className="riot-queue-tabs" role="tablist" aria-label="큐 고르기">
        {MATCH_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`riot-queue-tab ${tab === t.key ? 'is-on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mine.length > 0 && (
        <div className="riot-summary">
          <strong>
            {mine.length}판 {wins}승 {mine.length - wins}패
          </strong>
          <span>승률 {Math.round((wins / mine.length) * 100)}%</span>
          <span>
            평균 {(sum('k') / mine.length).toFixed(1)} / {(sum('d') / mine.length).toFixed(1)} /{' '}
            {(sum('a') / mine.length).toFixed(1)} · {kdaRatio(sum('k'), sum('d'), sum('a'))} KDA
          </span>
        </div>
      )}

      {list?.error !== undefined && ids.length === 0 ? (
        <p className="riot-muted">{errorText(list.error)}</p>
      ) : list && !list.busy && ids.length === 0 ? (
        <p className="riot-muted">이 큐로 한 판이 없어요.</p>
      ) : (
        <ul className="riot-match-list">
          {ids.map((id) => {
            const r = matches[id];
            if (!r) return <li key={id} className="riot-match is-loading" />;
            if (r.error !== undefined) {
              return (
                <li key={id} className="riot-match is-error">
                  <span className="riot-muted">{errorText(r.error)}</span>
                  <button type="button" className="ghost-btn" onClick={() => fetchMatch(id)}>
                    다시
                  </button>
                </li>
              );
            }
            return (
              <MatchRow key={id} m={r.data} me={me} champs={champs} onSearch={onSearch} onDetail={onDetail} />
            );
          })}
          {list?.busy && ids.length === 0 &&
            [0, 1, 2].map((i) => <li key={`s${i}`} className="riot-match is-loading" />)}
        </ul>
      )}

      {list?.more && (
        <button
          type="button"
          className="ghost-btn riot-more"
          disabled={list.busy}
          onClick={() => loadPage(tab, ids.length)}
        >
          {list.busy ? '불러오는 중…' : '20판 더 보기'}
        </button>
      )}
      {list?.error !== undefined && ids.length > 0 && (
        <p className="riot-muted">{errorText(list.error)}</p>
      )}
    </div>
  );
};

export default MatchList;
