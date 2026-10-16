import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { riotGet, loadSoloRanks } from '../../server/riot';
import {
  queueName,
  clock,
  kdaRatio,
  errorText,
  MATCH_TABS,
  kilo,
  num,
  tierIconOf,
  tierText,
  isApex,
} from '../../rules/riot';
import { timeAgo } from '../../lib/timeAgo';
import { Champ, Items, Lane } from './RiotBits';
import { useAliasOf } from './useRiotFavs';
import MatchDetail from './MatchDetail';
import PlayStats from './PlayStats';
import { mvpOf, contribution, summarize } from '../../rules/riotStats';

/* 롤 최근 매치. 위에서 큐(전체 · 솔로 · 자유 · 일반 · 칼바람)를 고르면 그
   큐의 판만 라이엇이 걸러 준다. 20판씩, '더 보기'로 이어 받는다.

   판 상세는 한 판씩 따로 받는다 - 끝난 판은 안 바뀌어서 서버가 하루 캐시하고,
   화면도 한 번 받은 판은 다시 안 부른다 (server/riot.js).
   큐를 바꿨다 돌아와도 받아둔 목록은 그대로 둔다 */

/* 아직 안 받은 큐의 목록. 렌더마다 새 []를 만들면 아래 effect들이 매번 돈다 */
const EMPTY = [];

/* MVP(이긴 팀 1등) · ACE(진 팀 1등). 기여 점수는 rules/riotStats.js */
const Badge = ({ m, p, ranks }) => {
  const kind = ranks.mvp === p.puuid ? 'mvp' : ranks.ace === p.puuid ? 'ace' : null;
  if (!kind) return null;
  return (
    <em
      className={`riot-badge is-${kind}`}
      title={`기여 점수 ${contribution(m, p)} / 10 (킬 관여 · 피해 · 골드 · 시야 비중)`}
    >
      {kind === 'mvp' ? 'MVP' : 'ACE'}
    </em>
  );
};

/* 솔로 랭크 작은 표시: 티어 그림 + 디비전(I~IV). 언랭은 같은 폭의 빈자리 -
   이름의 시작점이 줄마다 맞게 */
const MiniRank = ({ r }) =>
  r === undefined ? (
    <span className="riot-mini-rank is-loading" aria-hidden="true" />
  ) : r ? (
    <span className="riot-mini-rank" title={`솔로 랭크 ${tierText(r.tier, r.rank)} · ${r.lp}LP`}>
      <img src={tierIconOf(r.tier)} alt={tierText(r.tier, r.rank)} />
      {!isApex(r.tier) && <b>{r.rank}</b>}
    </span>
  ) : (
    <span className="riot-mini-rank" title="솔로 랭크 없음" />
  );

/* 펼치면 '간단히'는 두 팀. 더 자세한 건 '상세 정보'가 맡는다 */
const Teams = ({ m, me, champs, onSearch }) => {
  const aliasOf = useAliasOf();
  const ranks = mvpOf(m);
  /* 열 명의 솔로 랭크. 이미 아는 사람은 안 묻는다 (server/riot.js) */
  const [solo, setSolo] = useState(null);
  useEffect(() => {
    let alive = true;
    loadSoloRanks(m.players.map((p) => p.puuid)).then((map) => alive && setSolo(map));
    return () => {
      alive = false;
    };
  }, [m]);
  return (
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
                    className="riot-link riot-team-name"
                    onClick={() => p.name && onSearch(`${p.name}#${p.tag}`)}
                  >
                    <MiniRank r={solo ? solo.get(p.puuid) : undefined} />
                    {p.name || '?'}
                    {aliasOf(`${p.name}#${p.tag}`) && (
                      <em className="riot-alias">{aliasOf(`${p.name}#${p.tag}`)}</em>
                    )}
                    <Badge m={m} p={p} ranks={ranks} />
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
};

/* 펼친 칸 안에서 고르는 보기. 두 팀(가볍게)이 먼저, 게임 상세는 눌렀을 때만
   받는다 (타임라인이 커서) */
const OPEN_VIEWS = [
  { key: 'teams', label: '간단히' },
  { key: 'detail', label: '상세 정보' },
];

const MatchRow = ({ m, me, champs, onSearch }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('teams');
  const p = m.players.find((x) => x.puuid === me);
  if (!p) return null;
  const minutes = m.duration / 60 || 1;
  // 5분 안에 끝난 판은 다시하기(리메이크)
  const remake = m.duration < 300;
  const result = remake ? 'is-remake' : p.win ? 'is-win' : 'is-lose';
  const teamKills = m.teams.find((t) => t.id === p.team)?.kills || 0;
  const kp = teamKills ? Math.round(((p.k + p.a) / teamKills) * 100) : 0;

  return (
    <li className={`riot-match ${result}`}>
      <button
        type="button"
        className="riot-match-row"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="riot-match-result">
          <strong>
            {remake ? '다시하기' : p.win ? '승리' : '패배'}
            <Badge m={m} p={p} ranks={mvpOf(m)} />
          </strong>
          <em>{queueName(m.queue, m.mode)}</em>
          <em>
            {m.end ? timeAgo(m.end) : ''} · {clock(m.duration)}
          </em>
        </span>
        {/* 라인은 초상화 바로 왼쪽. KDA 글자 끝에 붙여뒀더니 눈에 안 걸렸다 */}
        <span className="riot-match-champ">
          <Lane pos={p.pos} iconOnly />
          <Champ champs={champs} name={p.champ} level={p.level} />
        </span>
        <span className="riot-match-kda">
          <strong>
            {p.k} / <i>{p.d}</i> / {p.a}
          </strong>
          <em>{kdaRatio(p.k, p.d, p.a)} KDA</em>
          <em>킬 관여 {kp}%</em>
        </span>
        <span className="riot-match-stat">
          <em>
            CS {p.cs} ({(p.cs / minutes).toFixed(1)})
          </em>
          <em>피해 {num(p.dmg)}</em>
          {p.multi >= 3 && <b>{['', '', '', '트리플킬', '쿼드라킬', '펜타킬'][p.multi]}</b>}
        </span>
        <Items items={p.items} version={champs?.version} />
        {/* 같이 뛴 열 명. 넓은 화면에서만 (OP.GG처럼 오른쪽에 두 줄) */}
        <span className="riot-match-people" aria-hidden="true">
          {[100, 200].map((team) => (
            <span key={team} className="riot-match-people-col">
              {m.players
                .filter((x) => x.team === team)
                .map((x) => (
                  <span key={x.puuid} className={x.puuid === me ? 'is-me' : ''}>
                    <Champ champs={champs} name={x.champ} size="xs" />
                    <i>{x.name || '?'}</i>
                  </span>
                ))}
            </span>
          ))}
        </span>
        <FaChevronDown className={`riot-chev ${open ? 'is-open' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="riot-match-open">
          <div className="riot-open-tabs" role="tablist" aria-label="펼쳐 보기">
            {OPEN_VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={view === v.key}
                className={`riot-queue-tab ${view === v.key ? 'is-on' : ''}`}
                onClick={() => setView(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
          {view === 'teams' ? (
            <Teams m={m} me={me} champs={champs} onSearch={onSearch} />
          ) : (
            <MatchDetail id={m.id} me={me} champs={champs} onSearch={onSearch} />
          )}
        </div>
      )}
    </li>
  );
};

const MatchList = ({ puuid, me, champs, onSearch, fresh = false }) => {
  const [tab, setTab] = useState('all');
  const top = useRef(null);

  /* 큐를 바꾸면 목록 맨 위로. 스크롤이 그대로면 바뀐 목록의 중간부터 보여서
     무엇이 바뀌었는지 모른다. 이미 목록 위쪽이 보이면 움직이지 않는다 */
  const pickTab = (key) => {
    setTab(key);
    const el = top.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
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

  const list = lists[tab];
  /* 받아 둔 판들로 셈한 분석 (rules/riotStats.js) */
  const stats = summarize(ids.map((id) => matches[id]?.data).filter(Boolean), me);

  return (
    <div className="riot-matches" ref={top}>
      {/* 스크롤을 따라온다 (TFT 탭이 있으면 그 밑에) */}
      <div className="riot-queue-tabs riot-stick is-sub" role="tablist" aria-label="큐 고르기">
        {MATCH_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`riot-queue-tab ${tab === t.key ? 'is-on' : ''}`}
            onClick={() => pickTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <PlayStats s={stats} champs={champs} onSearch={onSearch} />

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
              <MatchRow key={id} m={r.data} me={me} champs={champs} onSearch={onSearch} />
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
