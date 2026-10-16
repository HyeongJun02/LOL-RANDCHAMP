import React, { useEffect, useState } from 'react';
import { FaChevronLeft, FaChevronRight, FaClock } from 'react-icons/fa';
import {
  GiCrossedSwords,
  GiStoneTower,
  GiCastle,
  GiSpikedDragonHead,
  GiEyeball,
  GiWorms,
  GiSandSnake,
} from 'react-icons/gi';
import { riotGet, champIconUrl } from '../../server/riot';
import {
  queueName,
  errorText,
  dateTimeText,
  durationText,
  clockMs,
  monsterName,
  buildingName,
  dragonIconOf,
  kdaRatio,
  kilo,
  num,
} from '../../rules/riot';
import GoldChart from './GoldChart';
import { Champ, Items, Lane, champName } from './RiotBits';
import { useAliasOf } from './useRiotFavs';

/* 게임 상세. 한 판을 정밀하게 - OP.GG의 펼친 판처럼 위에 요약, 아래는 탭.
     머리      결과 · 큐 · 패치 · 시작 시각 · 길이 · 이전/다음 판
     요약      두 팀 한 줄씩 (킬 · 골드 · 잡은 용 그림 · 오브젝트 수)
     종합      두 팀 열 명. 한 줄에 한 명 (가로 스크롤 없이)
     팀 분석   항목 하나를 골라 열 명을 막대로 견준다
     오브젝트  게임 시간 축 위에 '언제 무엇을' + 시각순 목록
     타임라인  골드 차이 그래프 + 킬 · 오브젝트 · 건물 이벤트

   한 화면에 다 쌓았더니 세로로 너무 길었다. 탭으로 나눈다.
   매치와 타임라인은 따로 받는다. 타임라인이 늦거나 실패해도 종합은 먼저 보인다 */

const TEAM_NAME = { 100: '블루팀', 200: '레드팀' };
const TEAMS = [100, 200];

const VIEWS = [
  { key: 'overview', label: '종합' },
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

/* ---------- 요약: 팀 한 줄 ---------- */

const TeamStrip = ({ m, team, dragons }) => {
  const t = m.teams.find((x) => x.id === team) || {};
  const gold = m.players.filter((p) => p.team === team).reduce((s, p) => s + (p.gold || 0), 0);
  const objs = [
    ['바론', t.baron, <GiSpikedDragonHead key="b" />],
    ['전령', t.herald, <GiEyeball key="h" />],
    ['유충', t.grubs, <GiWorms key="g" />],
    ['아타칸', t.atakhan, <GiSandSnake key="a" />],
    ['포탑', t.tower, <GiStoneTower key="t" />],
    ['억제기', t.inhib, <GiCastle key="i" />],
  ];
  return (
    <div className={`riot-strip ${team === 100 ? 'is-blue' : 'is-red'}`}>
      <span className="riot-strip-name">
        <strong>{TEAM_NAME[team]}</strong>
        <em className={t.win ? 'is-win' : 'is-lose'}>{t.win ? '승리' : '패배'}</em>
      </span>
      <span className="riot-strip-score">
        <b>{t.kills}</b>킬 · <b>{kilo(gold)}</b>골드
      </span>
      {/* 용은 잡은 순서대로 그 종류의 그림. 숫자만으로는 영혼 각인지 모른다 */}
      <span className="riot-strip-dragons" aria-label={`용 ${dragons.length}마리`}>
        {dragons.map((d, i) => (
          <span key={i} title={`${clockMs(d.t)} ${monsterName('DRAGON', d.sub)}`}>
            <MonsterIcon monster="DRAGON" sub={d.sub} />
          </span>
        ))}
      </span>
      <span className="riot-strip-objs">
        {objs.map(([label, n, icon]) => (
          <span key={label} className={n ? '' : 'is-zero'} title={label}>
            {icon}
            <b>{n ?? 0}</b>
          </span>
        ))}
      </span>
    </div>
  );
};

/* ---------- 종합: 한 줄에 한 명 ---------- */

const PlayerRow = ({ m, p, me, champs, onSearch, maxDmg }) => {
  const aliasOf = useAliasOf();
  const alias = aliasOf(`${p.name}#${p.tag}`);
  const minutes = m.duration / 60 || 1;
  return (
    <li className={`riot-prow ${p.puuid === me ? 'is-me' : ''}`}>
      <span className="riot-prow-champ">
        <Lane pos={p.pos} iconOnly />
        <Champ champs={champs} name={p.champ} size="sm" level={p.level} />
      </span>
      <span className="riot-prow-name">
        <button type="button" className="riot-link" onClick={() => p.name && onSearch(`${p.name}#${p.tag}`)}>
          {p.name || '?'}
        </button>
        {alias ? <em className="riot-alias">{alias}</em> : <em className="riot-prow-champname">{champName(champs, p.champ)}</em>}
      </span>
      <span className="riot-prow-kda">
        <strong>
          {p.k}/<i>{p.d}</i>/{p.a}
        </strong>
        <em>
          {kdaRatio(p.k, p.d, p.a)} · 관여 {killShare(m, p)}%
        </em>
      </span>
      <span className="riot-prow-dmg" title={`가한 피해 ${num(p.dmg)}`}>
        <b>{num(p.dmg)}</b>
        <i style={{ width: `${maxDmg ? ((p.dmg || 0) / maxDmg) * 100 : 0}%` }} />
      </span>
      <span className="riot-prow-cs">
        <b>{num(p.cs)}</b>
        <em>{((p.cs || 0) / minutes).toFixed(1)}/분</em>
      </span>
      <span className="riot-prow-ward" title="시야 점수 · 와드 설치/제거">
        <b>{num(p.vision)}</b>
        <em>
          {num(p.wards)}/{num(p.wardsKilled)}
        </em>
      </span>
      <Items items={p.items} version={champs?.version} small />
    </li>
  );
};

const Overview = ({ m, me, champs, onSearch }) => {
  const maxDmg = Math.max(...m.players.map((p) => p.dmg || 0));
  return (
    <div className="riot-overview">
      {TEAMS.map((team) => {
        const t = m.teams.find((x) => x.id === team) || {};
        return (
          <section key={team} className={`riot-ov-team ${team === 100 ? 'is-blue' : 'is-red'}`}>
            {/* 머리줄도 선수 줄과 같은 칸 나눔이라 열 이름이 숫자 바로 위에 선다.
                열 이름은 넓은 화면에서만 (좁으면 칸이 접힌다) */}
            <header className="riot-ov-head">
              <strong>
                {TEAM_NAME[team]} <em className={t.win ? 'is-win' : 'is-lose'}>{t.win ? '승리' : '패배'}</em>
              </strong>
              <span className="riot-ov-col">KDA · 관여</span>
              <span className="riot-ov-col">가한 피해</span>
              <span className="riot-ov-col">CS</span>
              <span className="riot-ov-col">시야</span>
              <span className="riot-ov-col">아이템</span>
            </header>
            {t.bans?.length > 0 && (
                <span className="riot-ov-bans">
                  밴
                  {t.bans.map((cid, i) => {
                    const c = champs?.byKey.get(cid);
                    return c ? (
                      <img key={i} src={champIconUrl(champs.version, c.id)} alt={c.name} title={c.name} />
                    ) : null;
                  })}
                </span>
            )}
            <ol className="riot-prows">
              {m.players
                .filter((p) => p.team === team)
                .map((p) => (
                  <PlayerRow key={p.puuid} m={m} p={p} me={me} champs={champs} onSearch={onSearch} maxDmg={maxDmg} />
                ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
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

      {/* 킬 관여는 팀끼리 더하면 뜻이 없다 (각자 자기 팀 킬로 나눈 값) */}
      {metric.key !== 'kp' && (
        <div className="riot-share">
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
      )}

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

const MatchDetail = ({ id, ids = [], me, champs, onSearch, onPick }) => {
  const [m, setM] = useState(null);
  const [tl, setTl] = useState(null);
  /* 판을 넘겨도 보던 탭은 그대로 */
  const [view, setView] = useState('overview');

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

  if (!id) return <p className="riot-muted">최근 매치에서 판을 펼치고 '게임 상세 보기'를 눌러 주세요.</p>;
  if (!m) return <div className="riot-loading">불러오는 중…</div>;
  if (m.error !== undefined) return <p className="riot-muted">{errorText(m.error)}</p>;

  const d = m.data;
  const byPuuid = new Map(d.players.map((p) => [p.puuid, p]));
  const meP = byPuuid.get(me);
  const at = ids.indexOf(id);
  const events = tl?.data?.events || [];
  const dragonsOf = (team) =>
    events.filter((e) => e.kind === 'monster' && e.monster === 'DRAGON' && e.team === team);
  const needsTimeline = view === 'objectives' || view === 'timeline';

  return (
    <div className="riot-full">
      <div className="riot-full-head">
        <div className="riot-full-title">
          {meP && (
            <span className={`riot-full-result ${meP.win ? 'is-win' : 'is-lose'}`}>
              {meP.win ? '승리' : '패배'}
            </span>
          )}
          <strong>{queueName(d.queue, d.mode)}</strong>
          {d.patch && <em>{d.patch} 패치</em>}
        </div>
        <div className="riot-full-time">
          <FaClock aria-hidden="true" />
          <span>{dateTimeText(d.start)} 시작</span>
          <span>· {durationText(d.duration)}</span>
        </div>
        {ids.length > 1 && at >= 0 && (
          <div className="riot-full-nav">
            <button type="button" className="ghost-btn" disabled={at <= 0} onClick={() => onPick(ids[at - 1])}>
              <FaChevronLeft /> 더 최근 판
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={at >= ids.length - 1}
              onClick={() => onPick(ids[at + 1])}
            >
              이전 판 <FaChevronRight />
            </button>
          </div>
        )}
      </div>

      <div className="riot-strips">
        {TEAMS.map((team) => (
          <TeamStrip key={team} m={d} team={team} dragons={dragonsOf(team)} />
        ))}
      </div>

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

      {view === 'overview' && <Overview m={d} me={me} champs={champs} onSearch={onSearch} />}
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
