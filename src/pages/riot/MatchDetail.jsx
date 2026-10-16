import React, { useEffect, useState } from 'react';
import { FaClock } from 'react-icons/fa';
import {
  GiCrossedSwords,
  GiStoneTower,
  GiCastle,
  GiSpikedDragonHead,
  GiEyeball,
  GiWorms,
  GiSandSnake,
} from 'react-icons/gi';
import { riotGet } from '../../server/riot';
import {
  errorText,
  dateTimeText,
  durationText,
  clockMs,
  monsterName,
  buildingName,
  dragonIconOf,
  num,
} from '../../rules/riot';
import GoldChart from './GoldChart';
import { Champ, champName } from './RiotBits';
import { matchInsights } from '../../rules/riotStats';

/* 게임 상세. 매치 목록에서 판을 펼치고 '상세 정보'를 고르면 그 칸 안에 열린다.
     시각       시작 시각 · 길이 · 패치
     요약       이 판에서 셈해 낸 몇 줄 (역전승 · 15분 골드 · 처음 가져간 것 · 캐리)
     팀 분석    항목 하나를 골라 열 명을 막대로 견준다
     오브젝트   게임 시간 축 위에 '언제 무엇을' + 세로 타임라인
     타임라인   골드 차이 그래프 + 킬 · 오브젝트 · 건물 이벤트

   결과 · 큐 · 열 명의 KDA와 아이템은 '간단히'와 매치 줄에 있어서 여기 다시 두지 않는다.
   매치와 타임라인은 따로 받는다. 타임라인이 늦거나 실패해도 팀 분석은 먼저 보인다 */

const TEAMS = [100, 200];

const VIEWS = [
  { key: 'analysis', label: '팀 분석' },
  { key: 'objectives', label: '오브젝트' },
  { key: 'timeline', label: '타임라인' },
];

const EVENT_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'kill', label: '킬' },
  { key: 'monster', label: '오브젝트' },
  { key: 'building', label: '건물' },
];

/* 용이 아닌 오브젝트는 그림 대신 아이콘 */
const MONSTER_ICONS = {
  BARON_NASHOR: <GiSpikedDragonHead />,
  RIFTHERALD: <GiEyeball />,
  HORDE: <GiWorms />,
  ATAKHAN: <GiSandSnake />,
  DRAGON: <GiSpikedDragonHead />,
};

const MonsterIcon = ({ monster, sub }) => {
  const url = monster === 'DRAGON' ? dragonIconOf(sub) : null;
  return url ? (
    <img className="riot-ev-img" src={url} alt="" />
  ) : (
    <span className="riot-ev-glyph">{MONSTER_ICONS[monster] || <GiSpikedDragonHead />}</span>
  );
};

/* 킬 관여율. 팀 킬이 0이면 나눌 수 없다 */
const killShare = (m, p) => {
  const teamKills = m.teams.find((t) => t.id === p.team)?.kills || 0;
  return teamKills ? Math.round(((p.k + p.a) / teamKills) * 100) : 0;
};

/* ---------- 팀 분석: 항목 하나를 열 명이 막대로 ---------- */

const METRICS = [
  { key: 'dmg', label: '가한 피해', get: (p) => p.dmg },
  { key: 'taken', label: '받은 피해', get: (p) => p.taken },
  { key: 'gold', label: '골드', get: (p) => p.gold },
  { key: 'cs', label: 'CS', get: (p) => p.cs },
  { key: 'kp', label: '킬 관여', get: (p, m) => killShare(m, p), unit: '%' },
  { key: 'vision', label: '시야 점수', get: (p) => p.vision },
  { key: 'wards', label: '와드 설치', get: (p) => p.wards },
  { key: 'wardsKilled', label: '와드 제거', get: (p) => p.wardsKilled },
  { key: 'pinks', label: '제어 와드', get: (p) => p.pinks },
];

const Analysis = ({ m, me, champs }) => {
  const [key, setKey] = useState('dmg');
  const metric = METRICS.find((x) => x.key === key);
  const val = (p) => metric.get(p, m) || 0;
  const max = Math.max(1, ...m.players.map(val));
  const total = (team) => m.players.filter((p) => p.team === team).reduce((s, p) => s + val(p), 0);
  const all = total(100) + total(200);
  const blueShare = all ? Math.round((total(100) / all) * 100) : 50;

  return (
    <div className="riot-analysis">
      <div className="riot-ev-filters" role="tablist" aria-label="견줄 항목">
        {METRICS.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={key === x.key}
            className={`riot-queue-tab ${key === x.key ? 'is-on' : ''}`}
            onClick={() => setKey(x.key)}
          >
            {x.label}
          </button>
        ))}
      </div>

      {/* 킬 관여는 팀끼리 더하면 뜻이 없다 (각자 자기 팀 킬로 나눈 값).
          그래도 줄은 남겨 둔다 - 빠지면 아래 막대들이 위로 들썩인다 */}
      <div className={`riot-share ${metric.key === 'kp' ? 'is-blank' : ''}`} aria-hidden={metric.key === 'kp'}>
        <span className="riot-share-label is-blue">
          블루팀 {num(total(100))} · {blueShare}%
        </span>
        <span className="riot-share-bar" aria-hidden="true">
          <i className="is-blue" style={{ width: `${blueShare}%` }} />
          <i className="is-red" style={{ width: `${100 - blueShare}%` }} />
        </span>
        <span className="riot-share-label is-red">
          {100 - blueShare}% · {num(total(200))} 레드팀
        </span>
      </div>

      <div className="riot-bars">
        {TEAMS.map((team) => (
          <ol key={team} className={`riot-bar-list ${team === 100 ? 'is-blue' : 'is-red'}`}>
            {m.players
              .filter((p) => p.team === team)
              .map((p) => (
                <li key={p.puuid} className={p.puuid === me ? 'is-me' : ''}>
                  <Champ champs={champs} name={p.champ} size="sm" />
                  <span className="riot-bar-name">{p.name || '?'}</span>
                  <span className="riot-bar-track">
                    <i style={{ width: `${(val(p) / max) * 100}%` }} />
                  </span>
                  <b className="riot-bar-val">
                    {num(val(p))}
                    {metric.unit || ''}
                  </b>
                </li>
              ))}
          </ol>
        ))}
      </div>
    </div>
  );
};

/* ---------- 오브젝트: 시간 축 + 목록 ---------- */

const Objectives = ({ m, events, champs, byPuuid }) => {
  const total = Math.max(1, m.duration * 1000);
  const monsters = events.filter((e) => e.kind === 'monster');
  /* 건물은 많아서 축에는 억제기만. 첫 포탑은 목록에 따로 */
  const inhibs = events.filter((e) => e.kind === 'building' && e.building === 'INHIBITOR_BUILDING');
  const firstTower = events.find((e) => e.kind === 'building' && e.building === 'TOWER_BUILDING');
  const marks = [...monsters, ...inhibs];
  const ticks = [];
  for (let min = 5; min * 60000 < total; min += 5) ticks.push(min);

  const list = [...marks, ...(firstTower ? [{ ...firstTower, first: true }] : [])].sort((a, b) => a.t - b.t);

  return (
    <div className="riot-objectives">
      {/* 위는 블루팀이 잡은 것, 아래는 레드팀. 가로 위치가 시각 */}
      <div className="riot-axis" role="img" aria-label="오브젝트를 잡은 시각">
        {TEAMS.map((team) => (
          <div key={team} className={`riot-axis-lane ${team === 100 ? 'is-blue' : 'is-red'}`}>
            <span className="riot-axis-team">{team === 100 ? '블루' : '레드'}</span>
            <div className="riot-axis-track">
              {marks
                .filter((e) => e.team === team)
                .map((e, i) => (
                  <span
                    key={i}
                    className="riot-axis-mark"
                    style={{ left: `${(e.t / total) * 100}%` }}
                    title={`${clockMs(e.t)} ${
                      e.kind === 'monster' ? monsterName(e.monster, e.sub) : buildingName(e.building, e.tower, e.lane)
                    }`}
                  >
                    {e.kind === 'monster' ? <MonsterIcon monster={e.monster} sub={e.sub} /> : <GiCastle />}
                  </span>
                ))}
            </div>
          </div>
        ))}
        <div className="riot-axis-ticks" aria-hidden="true">
          <span className="riot-axis-team" />
          <div className="riot-axis-track">
            {ticks.map((min) => (
              <span key={min} style={{ left: `${((min * 60000) / total) * 100}%` }}>
                {min}분
              </span>
            ))}
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="riot-muted">잡은 오브젝트가 없어요.</p>
      ) : (
        <ol className="riot-vtl">
          <li className="riot-vtl-row riot-vtl-legend" aria-hidden="true">
            <span className="riot-vtl-side is-left">블루팀</span>
            <span className="riot-vtl-time" />
            <span className="riot-vtl-side is-right">레드팀</span>
          </li>
          {list.map((e, i) => (
            <EventRow key={i} e={e} byPuuid={byPuuid} champs={champs} />
          ))}
        </ol>
      )}
    </div>
  );
};

/* ---------- 타임라인: 이벤트 한 줄 ----------
   가운데 세로줄에 시각, 블루팀이 한 일은 왼쪽 · 레드팀은 오른쪽.
   어느 쪽에 놓였는지가 곧 어느 팀인지라 글자로 팀을 또 적지 않는다 */

const EventRow = ({ e, byPuuid, champs, me }) => {
  const who = (puuid) => byPuuid.get(puuid);
  const team = e.team === 100 ? 'is-blue' : e.team === 200 ? 'is-red' : '';
  const mine = [e.killer, e.victim, ...(e.assists || [])].includes(me);

  let icon;
  let body;
  if (e.kind === 'kill') {
    const k = who(e.killer);
    const v = who(e.victim);
    icon = <GiCrossedSwords />;
    body = (
      <>
        {k ? (
          <span className="riot-ev-who">
            <Champ champs={champs} name={k.champ} size="xs" />
            {k.name}
          </span>
        ) : (
          <span className="riot-ev-who riot-muted">처형</span>
        )}
        <span className="riot-ev-arrow" aria-label="처치">
          →
        </span>
        {v && (
          <span className="riot-ev-who is-victim">
            <Champ champs={champs} name={v.champ} size="xs" />
            {v.name}
          </span>
        )}
        {e.assists.length > 0 && <em className="riot-ev-sub">어시 {e.assists.length}</em>}
      </>
    );
  } else if (e.kind === 'monster') {
    icon = <MonsterIcon monster={e.monster} sub={e.sub} />;
    const k = who(e.killer);
    body = (
      <>
        <strong>{monsterName(e.monster, e.sub)}</strong>
        {k && (
          <em className="riot-ev-sub">
            {k.name} ({champName(champs, k.champ)})
          </em>
        )}
      </>
    );
  } else {
    icon = e.building === 'INHIBITOR_BUILDING' ? <GiCastle /> : <GiStoneTower />;
    body = (
      <>
        <strong>
          {e.first && '첫 포탑 · '}
          {buildingName(e.building, e.tower, e.lane)} 파괴
        </strong>
      </>
    );
  }

  const card = (
    <span className={`riot-vtl-card kind-${e.kind} ${mine ? 'is-me' : ''}`}>
      <span className="riot-ev-icon">{icon}</span>
      <span className="riot-ev-body">{body}</span>
    </span>
  );
  /* 팀을 모르는 일(드물다)은 왼쪽에 둔다 */
  const right = e.team === 200;
  return (
    <li className={`riot-vtl-row ${team}`}>
      <span className="riot-vtl-side is-left">{!right && card}</span>
      <time className="riot-vtl-time">{clockMs(e.t)}</time>
      <span className="riot-vtl-side is-right">{right && card}</span>
    </li>
  );
};

const Timeline = ({ tl, byPuuid, champs, me }) => {
  const [filter, setFilter] = useState('all');
  const [mineOnly, setMineOnly] = useState(false);
  const events = tl.events || [];
  const shown = events.filter(
    (e) =>
      (filter === 'all' || e.kind === filter) &&
      (!mineOnly || [e.killer, e.victim, ...(e.assists || [])].includes(me))
  );
  return (
    <div className="riot-sub">
      <GoldChart diff={tl.goldDiff} />
      <div className="riot-ev-filters">
        {EVENT_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`riot-queue-tab ${filter === f.key ? 'is-on' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <em>{f.key === 'all' ? events.length : events.filter((e) => e.kind === f.key).length}</em>
          </button>
        ))}
        <label className="riot-check">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
          내가 낀 것만
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="riot-muted">해당하는 일이 없어요.</p>
      ) : (
        <ol className="riot-vtl is-scroll">
          {/* 머리: 어느 쪽이 어느 팀인지 */}
          <li className="riot-vtl-row riot-vtl-legend" aria-hidden="true">
            <span className="riot-vtl-side is-left">블루팀</span>
            <span className="riot-vtl-time" />
            <span className="riot-vtl-side is-right">레드팀</span>
          </li>
          {shown.map((e, i) => (
            <EventRow key={i} e={e} byPuuid={byPuuid} champs={champs} me={me} />
          ))}
        </ol>
      )}
    </div>
  );
};

/* ---------- 본체 ---------- */

const MatchDetail = ({ id, me, champs }) => {
  const [m, setM] = useState(null);
  const [tl, setTl] = useState(null);
  const [view, setView] = useState('analysis');

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setM(null);
    setTl(null);
    riotGet({ fn: 'match', id }).then((r) => alive && setM(r));
    riotGet({ fn: 'timeline', id }).then((r) => alive && setTl(r));
    return () => {
      alive = false;
    };
  }, [id]);

  if (!m) return <div className="riot-loading">불러오는 중…</div>;
  if (m.error !== undefined) return <p className="riot-muted">{errorText(m.error)}</p>;

  const d = m.data;
  const byPuuid = new Map(d.players.map((p) => [p.puuid, p]));
  const events = tl?.data?.events || [];
  const needsTimeline = view === 'objectives' || view === 'timeline';
  const insights = tl?.data ? matchInsights(d, tl.data, me) : [];

  return (
    <div className="riot-full">
      {/* 결과 · 큐 · 열 명은 '간단히'와 매치 줄에 이미 있다. 여기는 시각과 패치만 */}
      <div className="riot-full-time">
        <FaClock aria-hidden="true" />
        <span>{dateTimeText(d.start)} 시작</span>
        <span>· {durationText(d.duration)}</span>
        {d.patch && <span>· {d.patch} 패치</span>}
      </div>

      {/* 이 판에서 셈해 낸 것들 (rules/riotStats.js의 matchInsights) */}
      {insights.length > 0 && (
        <ul className="riot-insights">
          {insights.map((x) => (
            <li key={x.kind} className={`is-${x.kind}`}>
              {x.text}
            </li>
          ))}
        </ul>
      )}

      <div className="riot-views" role="tablist" aria-label="상세 보기">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            className={`riot-view-tab ${view === v.key ? 'is-on' : ''}`}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'analysis' && <Analysis m={d} me={me} champs={champs} />}
      {needsTimeline &&
        (!tl ? (
          <p className="riot-muted">타임라인 불러오는 중…</p>
        ) : tl.error !== undefined ? (
          <p className="riot-muted">타임라인: {errorText(tl.error)}</p>
        ) : view === 'objectives' ? (
          <Objectives m={d} events={events} champs={champs} byPuuid={byPuuid} />
        ) : (
          <Timeline tl={tl.data} byPuuid={byPuuid} champs={champs} me={me} />
        ))}
    </div>
  );
};

export default MatchDetail;
