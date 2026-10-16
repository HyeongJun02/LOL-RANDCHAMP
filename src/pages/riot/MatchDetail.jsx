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
} from '../../rules/riot';
import GoldChart from './GoldChart';
import { Champ, Items, Lane, champName } from './RiotBits';

/* 게임 상세 탭. 한 판을 정밀하게.
     머리     결과 · 큐 · 패치 · 시작 시각 · 길이 · 이전/다음 판
     점수판   두 팀의 킬 · 골드 · 오브젝트(용은 종류별 아이콘, 잡은 순서대로) · 밴
     골드     분마다 두 팀 골드 차이
     타임라인 킬 · 오브젝트 · 건물을 초 단위로. 종류로 걸러 본다
     선수 표  피해량 · 받은 피해 · 골드 · CS · 시야 · 와드 · 아이템

   매치와 타임라인을 따로 받는다. 타임라인이 늦거나 실패해도 나머지는 먼저 보인다 */

const TEAM_NAME = { 100: '블루팀', 200: '레드팀' };

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

/* 점수판의 한 팀 */
const TeamBoard = ({ m, team, dragons, champs }) => {
  const t = m.teams.find((x) => x.id === team) || {};
  const gold = m.players.filter((p) => p.team === team).reduce((s, p) => s + p.gold, 0);
  const objs = [
    ['바론', t.baron, <GiSpikedDragonHead key="b" />],
    ['전령', t.herald, <GiEyeball key="h" />],
    ['유충', t.grubs, <GiWorms key="g" />],
    ['아타칸', t.atakhan, <GiSandSnake key="a" />],
    ['포탑', t.tower, <GiStoneTower key="t" />],
    ['억제기', t.inhib, <GiCastle key="i" />],
  ];
  return (
    <div className={`riot-board ${team === 100 ? 'is-blue' : 'is-red'}`}>
      <div className="riot-board-head">
        <strong>{TEAM_NAME[team]}</strong>
        <span className={`riot-board-result ${t.win ? 'is-win' : 'is-lose'}`}>{t.win ? '승리' : '패배'}</span>
      </div>
      <div className="riot-board-score">
        <span>
          <b>{t.kills}</b>
          <em>킬</em>
        </span>
        <span>
          <b>{kilo(gold)}</b>
          <em>골드</em>
        </span>
      </div>
      {/* 용은 잡은 순서대로 그 종류의 그림. 숫자만으로는 영혼 각인지 모른다 */}
      <div className="riot-board-dragons" aria-label={`용 ${dragons.length}마리`}>
        {dragons.length === 0 ? (
          <span className="riot-muted">용 없음</span>
        ) : (
          dragons.map((d, i) => (
            <span key={i} className="riot-board-dragon" title={`${clockMs(d.t)} ${monsterName('DRAGON', d.sub)}`}>
              <MonsterIcon monster="DRAGON" sub={d.sub} />
            </span>
          ))
        )}
      </div>
      <ul className="riot-board-objs">
        {objs.map(([label, n, icon]) => (
          <li key={label} className={n ? '' : 'is-zero'}>
            {icon}
            <span>{label}</span>
            <b>{n}</b>
          </li>
        ))}
      </ul>
      {t.bans?.length > 0 && (
        <div className="riot-board-bans">
          <span className="riot-label">밴</span>
          {t.bans.map((id, i) => {
            const c = champs?.byKey.get(id);
            return c ? (
              <img key={i} src={champIconUrl(champs.version, c.id)} alt={c.name} title={c.name} />
            ) : null;
          })}
        </div>
      )}
    </div>
  );
};

/* 타임라인 한 줄 */
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
        <em className="riot-ev-sub">
          {TEAM_NAME[e.team] || ''}
          {k && ` · ${k.name}(${champName(champs, k.champ)})`}
        </em>
      </>
    );
  } else {
    icon = e.building === 'INHIBITOR_BUILDING' ? <GiCastle /> : <GiStoneTower />;
    body = (
      <>
        <strong>{buildingName(e.building, e.tower, e.lane)} 파괴</strong>
        <em className="riot-ev-sub">{TEAM_NAME[e.team] || ''}</em>
      </>
    );
  }

  return (
    <li className={`riot-ev ${team} ${mine ? 'is-me' : ''} kind-${e.kind}`}>
      <time>{clockMs(e.t)}</time>
      <span className="riot-ev-icon">{icon}</span>
      <span className="riot-ev-body">{body}</span>
    </li>
  );
};

/* 선수 표. 피해량은 그 판 최고를 100%로 막대를 그린다 */
const PlayerTable = ({ m, team, me, champs, onSearch, maxDmg }) => {
  const minutes = m.duration / 60 || 1;
  return (
    <div className={`riot-table-wrap ${team === 100 ? 'is-blue' : 'is-red'}`}>
      <table className="riot-table">
        <caption>
          {TEAM_NAME[team]} {m.teams.find((t) => t.id === team)?.win ? '승리' : '패배'}
        </caption>
        <thead>
          <tr>
            <th scope="col">챔피언</th>
            <th scope="col" className="is-left">
              플레이어
            </th>
            <th scope="col">KDA</th>
            <th scope="col">가한 피해</th>
            <th scope="col">받은 피해</th>
            <th scope="col">골드</th>
            <th scope="col">CS</th>
            <th scope="col">시야</th>
            <th scope="col">와드</th>
            <th scope="col">아이템</th>
          </tr>
        </thead>
        <tbody>
          {m.players
            .filter((p) => p.team === team)
            .map((p) => (
              <tr key={p.puuid} className={p.puuid === me ? 'is-me' : ''}>
                <td>
                  <span className="riot-table-champ">
                    <Lane pos={p.pos} iconOnly />
                    <Champ champs={champs} name={p.champ} size="sm" level={p.level} />
                  </span>
                </td>
                <td className="is-left">
                  <button
                    type="button"
                    className="riot-link"
                    onClick={() => p.name && onSearch(`${p.name}#${p.tag}`)}
                  >
                    {p.name || '?'}
                    <em>#{p.tag}</em>
                  </button>
                </td>
                <td>
                  <span className="riot-table-kda">
                    {p.k}/{p.d}/{p.a}
                    <em>{kdaRatio(p.k, p.d, p.a)}</em>
                  </span>
                </td>
                <td>
                  <span className="riot-dmg">
                    {p.dmg.toLocaleString()}
                    <i style={{ width: `${maxDmg ? (p.dmg / maxDmg) * 100 : 0}%` }} />
                  </span>
                </td>
                <td>{p.taken.toLocaleString()}</td>
                <td>{p.gold.toLocaleString()}</td>
                <td>
                  {p.cs}
                  <em className="riot-table-sub">{(p.cs / minutes).toFixed(1)}/분</em>
                </td>
                <td>{p.vision}</td>
                <td title="설치 / 제거 · 제어 와드 구매">
                  {p.wards}/{p.wardsKilled}
                  <em className="riot-table-sub">제어 {p.pinks}</em>
                </td>
                <td>
                  <Items items={p.items} version={champs?.version} small />
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};

const MatchDetail = ({ id, ids = [], me, champs, onSearch, onPick }) => {
  const [m, setM] = useState(null);
  const [tl, setTl] = useState(null);
  const [filter, setFilter] = useState('all');
  const [mineOnly, setMineOnly] = useState(false);

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
  const shown = events.filter(
    (e) =>
      (filter === 'all' || e.kind === filter) &&
      (!mineOnly || [e.killer, e.victim, ...(e.assists || [])].includes(me))
  );
  const maxDmg = Math.max(...d.players.map((p) => p.dmg));

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
            <button
              type="button"
              className="ghost-btn"
              disabled={at <= 0}
              onClick={() => onPick(ids[at - 1])}
            >
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

      <div className="riot-boards">
        {[100, 200].map((team) => (
          <TeamBoard key={team} m={d} team={team} dragons={dragonsOf(team)} champs={champs} />
        ))}
      </div>

      <section className="riot-sub">
        <h3 className="riot-sub-h">타임라인</h3>
        {!tl ? (
          <p className="riot-muted">타임라인 불러오는 중…</p>
        ) : tl.error !== undefined ? (
          <p className="riot-muted">타임라인: {errorText(tl.error)}</p>
        ) : (
          <>
            <GoldChart diff={tl.data.goldDiff} />
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
              <ol className="riot-events">
                {shown.map((e, i) => (
                  <EventRow key={i} e={e} byPuuid={byPuuid} champs={champs} me={me} />
                ))}
              </ol>
            )}
          </>
        )}
      </section>

      <section className="riot-sub">
        <h3 className="riot-sub-h">선수별 기록</h3>
        {[100, 200].map((team) => (
          <PlayerTable
            key={team}
            m={d}
            team={team}
            me={me}
            champs={champs}
            onSearch={onSearch}
            maxDmg={maxDmg}
          />
        ))}
      </section>
    </div>
  );
};

export default MatchDetail;
